import {
  getElementBySelector,
  maybeGetElementBySelector,
  namespace,
} from "./utils";
import vanjs from "vanjs-core";

const { div, h5, p, button, a: anchor } = vanjs.tags;

function addLyricsForm() {
  const lyricsRoot = maybeGetElementBySelector<HTMLDivElement>(
    `#lyrics_line_sync:not([data-${namespace}-injected="true"])`,
  );
  if (!lyricsRoot) {
    return;
  }
  const caution = getElementBySelector<HTMLDivElement>(
    `.lyrics_caution`,
    lyricsRoot,
  );

  const form = div(
    { class: "tcml-container" },
    h5(
      { class: "tcml-title", style: "font-size: 110%;margin-bottom: 5px" },
      "MIDIから読み込む",
    ),
    p({ style: "margin-bottom: 5px" }, "MIDIの歌詞情報から読み込みます。"),
    anchor(
      {
        target: "_blank",
        href: "https://github.com/sevenc-nanashi/tunecore-midi-lyrics",
      },
      "MIDIファイルの仕様について",
    ),
    button({ class: "btn btn-default", type: "button" }, "MIDIを開く"),
  );
  caution.insertBefore(form, caution.nextElementSibling);
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
  setInterval(() => {
    addLyricsForm();
  }, 1000);
}

void main();
