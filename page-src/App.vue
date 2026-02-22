<script setup lang="ts">
import { R } from "@praha/byethrow";
import { computed, ref } from "vue";
import {
  midiToLyrics,
  type ConvertError,
  type LyricEvent,
} from "../src/midi.ts";

function toSrtTime(seconds: number): string {
  if (seconds < 0) {
    throw new Error("SRT time cannot be negative");
  }

  const milliseconds = Math.floor(seconds * 1000);
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const secs = Math.floor((milliseconds % 60000) / 1000);
  const ms = milliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatPosition(position: {
  measure: number;
  beat: number;
  tick: number;
}): string {
  return `${position.measure}.${position.beat}.${position.tick}`;
}

function errorToMessage(error: ConvertError): string {
  if (error.type === "parseError") {
    return `MIDIファイルを解析できませんでした: ${error.message}`;
  }

  if (error.type === "invalidTextEncoding") {
    return `MIDIの歌詞を正しくデコードできませんでした\n位置: ${error.positions.map(formatPosition).join("、")}`;
  }

  if (error.type === "noNote") {
    return `歌詞イベントに対応するノートが見つかりませんでした\n位置: ${error.positions.map(formatPosition).join("、")}`;
  }

  if (error.type === "excessiveTextEvents") {
    return `ノートに対応する歌詞イベントが不足しています\n位置: ${error.positions.map(formatPosition).join("、")}`;
  }

  if (error.type === "overlappingNotes") {
    return `ノートが重なっています\n位置: ${error.positions.map(formatPosition).join("、")}`;
  }

  throw new Error("Unknown error");
}

function lyricsToSrt(
  events: LyricEvent[],
  leadInSeconds: number,
): string {
  const shifted = events.map((event) => {
    const shiftedTime = event.time - leadInSeconds;
    if (shiftedTime < 0) {
      throw new Error(
        `時刻が負になります: ${event.time.toFixed(3)} - ${leadInSeconds.toFixed(3)}`,
      );
    }
    return { time: shiftedTime, text: event.text };
  });

  const lines: string[] = [];
  let index = 1;

  for (let i = 0; i < shifted.length; i += 1) {
    const start = shifted[i].time;
    const nextStart = i < shifted.length - 1 ? shifted[i + 1].time : start;
    const end = Math.max(start, nextStart);

    const safeText = shifted[i].text.trim() === "" ? " " : shifted[i].text;
    lines.push(
      String(index),
      `${toSrtTime(start)} --> ${toSrtTime(end)}`,
      safeText,
      "",
    );
    index += 1;
  }

  return lines.join("\n");
}

const leadInSeconds = ref(0);
const srtText = ref("");
const errorMessage = ref("");
const sourceFileName = ref("");
const lyricCount = ref(0);
const selectedMidiFile = ref<File | null>(null);

const suggestedFileName = computed(() => {
  if (sourceFileName.value === "") {
    return "lyrics.srt";
  }
  return `${sourceFileName.value.replace(/\.[^.]+$/, "")}.srt`;
});

async function convertFile(file: File): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const lyricsResult = midiToLyrics(new Uint8Array(arrayBuffer));
  if (R.isFailure(lyricsResult)) {
    errorMessage.value = errorToMessage(lyricsResult.error);
    srtText.value = "";
    lyricCount.value = 0;
    return;
  }

  errorMessage.value = "";
  lyricCount.value = lyricsResult.value.length;
  srtText.value = lyricsToSrt(
    lyricsResult.value,
    leadInSeconds.value,
  );
}

async function handleFileChange(event: Event): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    throw new Error("Unexpected input target");
  }

  const file = target.files?.[0];
  if (file === undefined) {
    return;
  }

  selectedMidiFile.value = file;
  sourceFileName.value = file.name;

  try {
    await convertFile(file);
  } catch (error) {
    errorMessage.value = `変換に失敗しました: ${String(error)}`;
  }
}

async function regenerate(): Promise<void> {
  if (selectedMidiFile.value === null) {
    throw new Error("MIDIファイルが未選択です");
  }

  try {
    await convertFile(selectedMidiFile.value);
  } catch (error) {
    errorMessage.value = `再生成に失敗しました: ${String(error)}`;
  }
}

function downloadSrt(): void {
  if (srtText.value === "") {
    throw new Error("SRTが空です");
  }

  const blob = new Blob([srtText.value], {
    type: "text/plain;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = suggestedFileName.value;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}
</script>

<template>
  <div class="converter-wrap">
    <section class="card converter-card">
      <div class="card-body p-4 p-md-5">
        <h1 class="h3 mb-2">TuneCore MIDI Lyrics: MIDI to SRT converter</h1>
        <p class="text-secondary mb-4">
          <a
            href="https://github.com/sevenc-nanahsi/tunecore-midi-lyrics"
            target="_blank"
            rel="noopener noreferrer"
            >TuneCore MIDI Lyrics</a
          >で使われるMIDIファイルの形式からニコニコ（ボカコレApp）登録用のSRTファイルを生成するツールです。<br />

          フォーマットは<a
            href="https://github.com/sevenc-nanashi/tunecore-midi-lyrics#usage"
            target="_blank"
            rel="noopener noreferrer"
            >こちら</a
          >を参照してください。
        </p>

        <div class="row g-3 mb-3">
          <div class="col-12 col-md-6">
            <label class="form-label fw-semibold" for="midi-input"
              >MIDIファイル</label
            >
            <input
              id="midi-input"
              class="form-control"
              type="file"
              accept=".mid,.midi"
              @change="handleFileChange"
            />
          </div>

          <div class="col-6 col-md-3">
            <label class="form-label fw-semibold" for="lead-in"
              >開始時間(秒)</label
            >
            <input
              id="lead-in"
              class="form-control"
              type="number"
              step="any"
              v-model.number="leadInSeconds"
            />
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-3">
          <button
            class="btn btn-outline-secondary"
            type="button"
            :disabled="selectedMidiFile === null"
            @click="regenerate"
          >
            現在の設定で再生成
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="srtText === ''"
            @click="downloadSrt"
          >
            SRTをダウンロード
          </button>
        </div>

        <div
          v-if="errorMessage !== ''"
          class="alert alert-danger mb-3"
          style="white-space: pre-wrap"
        >
          {{ errorMessage }}
        </div>
        <div class="small text-secondary mb-2" v-if="lyricCount > 0">
          抽出イベント数: {{ lyricCount }} / 出力ファイル名:
          {{ suggestedFileName }}
        </div>

        <textarea
          class="form-control srt-output"
          readonly
          :value="srtText"
          placeholder="MIDIを読み込むと、ここにSRTが表示されます。"
        ></textarea>
      </div>
    </section>
  </div>
</template>
