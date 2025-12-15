import vanjs from "vanjs-core";
import { R } from "@praha/byethrow";
import { match, P } from "ts-pattern";
import {
  createLogger,
  getElementBySelector,
  getElementsBySelector,
  maybeGetElementBySelector,
  namespace,
} from "./utils.ts";
import { midiToLyrics, type LyricEvent } from "./midi.ts";

const logger = createLogger("index");

const { div, h5, p, button, a: anchor, span, input } = vanjs.tags;

const offset = vanjs.state(0);

const ads = [
  "listening to my music on TuneCore <3: https://www.tunecore.co.jp/artists/sevenc-nanashi",
  "retweeting the announcement tweet <3: https://twitter.com/sevenc_nanashi/status/2000356981786415487",
];

function addLyricsForm() {
  const lyricsRoot = maybeGetElementBySelector<HTMLDivElement>(
    `#lyrics_line_sync:not([data-${namespace}-injected="true"])`,
  );
  if (!lyricsRoot) {
    return;
  }
  logger.info("Injecting MIDI lyrics form");
  const caution = getElementBySelector<HTMLDivElement>(`.caution`, lyricsRoot);

  const form = div(
    { class: "tcml-container" },
    h5(
      { class: "tcml-title", style: "font-size: 110%;margin-bottom: 5px" },
      "MIDIから読み込む",
      span(
        { style: "font-size: 80%; margin-left: 1rem; color: #8e8e8e" },
        anchor(
          {
            target: "_blank",
            href: "https://github.com/sevenc-nanashi/tunecore-midi-lyrics",
          },
          "TuneCore MIDI Lyrics",
        ),
        " by ",
        anchor(
          {
            target: "_blank",
            href: "https://www.tunecore.co.jp/artists/sevenc-nanashi",
            style: "color: #48b0d5",
          },
          "Nanashi.",
        ),
      ),
    ),
    p(
      { style: "margin-bottom: 5px; font-size: 80%" },
      "MIDIの歌詞情報を読み込み、歌詞入力欄に反映します。",
    ),
    div(
      {
        style: "display: flex; align-items: center",
      },
      div(
        {
          style: "display: flex; align-items: center",
        },
        p(
          {
            style: "font-size: 80%; cursor: help",
            title: "MIDI内のタイミングを早めます。",
          },
          "開始時間（秒）：",
        ),
        input(
          {
            type: "number",
            class: "form-control",
            value: () => offset.val,
            step: "any",
            style: "width: 5rem; margin-left: 5px; margin-right: 10px",
            onchange: (e: Event) => {
              const target = e.target as HTMLInputElement;
              const value = Number(target.value);
              offset.val = isNaN(value) ? 0 : value;
            },
          },
          [],
        ),
      ),
      button(
        { class: "btn btn-default", type: "button", onclick: loadMidiFile },
        "MIDIを開く",
      ),
      anchor(
        {
          target: "_blank",
          href: "https://github.com/sevenc-nanashi/tunecore-midi-lyrics#usage",
          style: "margin-left: 10px; font-size: 80%",
        },
        "使い方",
      ),
    ),
  );
  const parentElement = caution.parentElement;
  if (!parentElement) {
    throw new Error("Caution element has no parent");
  }
  parentElement.insertBefore(form, caution.nextElementSibling);

  lyricsRoot.dataset[namespace + "Injected"] = "true";
}

async function loadMidiFile() {
  logger.info("Loading MIDI file");
  const midiData = await openMidiFile();
  if (!midiData) {
    logger.warn("No MIDI file selected");
    return;
  }
  const lyricsResult = midiToLyrics(midiData);
  if (R.isFailure(lyricsResult)) {
    logger.error("Failed to parse MIDI file", lyricsResult.error);
    alert(
      `MIDIを読み込めませんでした。\n${match(lyricsResult.error)
        .with(
          { type: "parseError", message: P.string },
          ({ message }) => `MIDIファイルを解析できませんでした：${message}`,
        )
        .with(
          { type: "invalidTextEncoding", positions: P.array() },
          ({ positions }) =>
            `MIDIの歌詞を正しくデコードできませんでした。\n位置：${positions
              .map((p) => `${p.measure}.${p.beat}.${p.tick}`)
              .join("、")}`,
        )
        .with(
          { type: "noNote", positions: P.array() },
          ({ positions }) =>
            `MIDIの歌詞に対応するノートが見つかりませんでした。\n位置：${positions
              .map((p) => `${p.measure}.${p.beat}.${p.tick}`)
              .join("、")}`,
        )
        .with(
          { type: "excessiveTextEvents", positions: P.array() },
          ({ positions }) =>
            `MIDIの歌詞に対応していないノートが存在します。\n位置：${positions
              .map((p) => `${p.measure}.${p.beat}.${p.tick}`)
              .join("、")}`,
        )
        .with(
          { type: "overlappingNotes", positions: P.array() },
          ({ positions }) =>
            `ノートが重なっています。\n位置：${positions
              .map((p) => `${p.measure}.${p.beat}.${p.tick}`)
              .join("、")}`,
        )
        .exhaustive()}`,
    );
    return;
  }

  const lyrics = lyricsResult.value;

  if (lyrics[0].time < offset.val) {
    logger.warn(
      `Lyrics start time (${lyrics[0].time}) is before offset (${offset.val})`,
    );
    alert(
      `MIDIの歌詞の開始時間（${lyrics[0].time}秒）が、指定したオフセット時間（${offset.val}秒）より前です。オフセット時間を見直してください。`,
    );
    return;
  }

  const maxLyrics = 1500;
  if (lyrics.length > maxLyrics) {
    const confirmResult = confirm(
      `MIDIの歌詞数が多すぎます（${lyrics.length}個）。先頭の${maxLyrics}個のみを読み込みます。続行しますか？`,
    );
    if (!confirmResult) {
      logger.info("User cancelled loading due to excessive lyrics");
      return;
    }

    lyrics.splice(maxLyrics);
  } else {
    logger.info(`Parsed ${lyrics.length} lyric events from MIDI`);
  }

  clearLyrics();
  loadLyricsText(lyricsResult);
  setLyricsTime(lyrics);
  toPreviewMode();

  logger.success("MIDI lyrics loaded successfully");
  logger.success(
    `[AD] If you find this tool useful, consider ${ads[Math.floor(Math.random() * ads.length)]}`,
  );
}

function clearLyrics() {
  logger.info("Clearing existing lyrics");
  const lyricsRows = getElementsBySelector<HTMLDivElement>(".lyrics_row");
  for (const row of lyricsRows) {
    const removeButton = getElementBySelector<HTMLButtonElement>(
      ".remove_row_button",
      row,
    );
    const startTime = getElementBySelector<HTMLTableCellElement>(
      ".start-time",
      row,
    );
    if (startTime.textContent.trim() !== "") {
      removeButton.click();
    }
  }
}

function loadLyricsText(lyricsResult: R.Success<LyricEvent[]>) {
  const lyricsText = getElementBySelector<HTMLTextAreaElement>(
    "textarea.lyrics-text",
  );
  const lines = lyricsResult.value.map((event) => event.text);
  lyricsText.value = lines.join("\n");
  const event = new Event("input", { bubbles: true });
  lyricsText.dispatchEvent(event);

  logger.info("Lyrics loaded into textarea");
}

function setLyricsTime(lyrics: LyricEvent[]) {
  const internalAudio = getElementBySelector<HTMLAudioElement>(
    ".operation-button-wrapper audio",
  );
  const setButton = getElementBySelector<HTMLButtonElement>(
    ".audio_control_container .set-button",
  );
  // 実は、disabledを消すだけで押せるようになる
  setButton.removeAttribute("disabled");

  for (const [i, event] of lyrics.entries()) {
    const time = event.time - offset.val;
    internalAudio.currentTime = time;
    const timestampButton = getElementBySelector<HTMLButtonElement>(
      `.lyrics_row[data-row_num="${i + 1}"]`,
    );
    timestampButton.click();
    setButton.click();
  }

  internalAudio.currentTime = 0;
  setButton.setAttribute("disabled", "true");
  logger.info("Lyrics timing set");
}

function toPreviewMode() {
  const previewInput = getElementBySelector<HTMLInputElement>(
    '[name="preview_flag"]',
  );
  // プレビュー中は2回クリックして更新させる
  const numClicks = previewInput.checked ? 2 : 1;
  for (let i = 0; i < numClicks; i++) {
    previewInput.click();
  }
  logger.info("Preview toggled");
}

async function openMidiFile(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mid,.midi";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(new Uint8Array(result));
        } else {
          resolve(null);
        }
      };
      reader.readAsArrayBuffer(file);
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

async function main() {
  logger.info("Script started");
  setInterval(() => {
    addLyricsForm();
  }, 1000);
}

void main();
