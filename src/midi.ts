import { R } from "@praha/byethrow";
import { type Header, Midi } from "@tonejs/midi";
import { parseMidi } from "midi-file";

const epsilon = 0.001;

export type ConvertError =
  | {
      type: "parseError";
      message: string;
    }
  | {
      type: "invalidTextEncoding";
      positions: Position[];
    }
  | {
      type: "noNote";
      positions: Position[];
    }
  | {
      type: "excessiveTextEvents";
      positions: Position[];
    }
  | {
      type: "overlappingNotes";
      positions: Position[];
    };

export type LyricEvent = { time: number; text: string };

const parseTonejsMidi = R.try({
  try: (data: Uint8Array) => new Midi(data),
  catch: (e) => ({ type: "parseError" as const, message: String(e) }),
});
const parseMidiFile = R.try({
  try: (data: Uint8Array) => parseMidi(data),
  catch: (e) => ({ type: "parseError" as const, message: String(e) }),
});
const fixMidiFileTextEncoding = R.try({
  try: (data: string) => {
    return new TextDecoder().decode(
      new Uint8Array(data.split("").map((c) => c.charCodeAt(0))),
    );
  },
  catch: (e) => ({ type: "invalidTextEncoding" as const, message: String(e) }),
});

export function midiToLyrics(
  data: Uint8Array,
): R.Result<LyricEvent[], ConvertError> {
  const tonejsMidiResult = parseTonejsMidi(data);
  if (R.isFailure(tonejsMidiResult)) {
    return R.fail(tonejsMidiResult.error);
  }
  const tonejsMidi = tonejsMidiResult.value;

  const midiFileResult = parseMidiFile(data);
  if (R.isFailure(midiFileResult)) {
    return R.fail(midiFileResult.error);
  }
  const midiEvents = midiFileResult.value;

  const textEvents: { tick: number; text: string }[] = [];
  const invalidEncodingPositions: number[] = [];
  for (const track of midiEvents.tracks) {
    let currentTick = 0;
    for (const event of track) {
      currentTick += event.deltaTime;
      if (event.type === "text") {
        const decodeResult = fixMidiFileTextEncoding(event.text);
        if (R.isFailure(decodeResult)) {
          invalidEncodingPositions.push(currentTick);
        } else {
          textEvents.push({ tick: currentTick, text: decodeResult.value });
        }
      }
    }
  }
  if (invalidEncodingPositions.length > 0) {
    return R.fail({
      type: "invalidTextEncoding",
      positions: invalidEncodingPositions.map((tick) =>
        ticksToPosition(tonejsMidi.header, tick),
      ),
    });
  }

  const notes = tonejsMidi.tracks.flatMap((track) => track.notes);
  notes.sort((a, b) => a.ticks - b.ticks);
  const results: { time: number; text: string; midi: number }[] = [];

  const overlapTicks = new Set<number>();
  for (let i = 0; i < notes.length - 1; i++) {
    if (notes[i].ticks + notes[i].durationTicks > notes[i + 1].ticks) {
      overlapTicks.add(notes[i + 1].ticks);
    }
  }
  if (overlapTicks.size > 0) {
    return R.fail({
      type: "overlappingNotes",
      positions: Array.from(overlapTicks).map((tick) =>
        ticksToPosition(tonejsMidi.header, tick),
      ),
    });
  }

  const noNoteTicks: number[] = [];
  const noteTicks = new Set(notes.map((n) => n.ticks));
  for (const textEvent of textEvents) {
    const note = notes.find((n) => n.ticks === textEvent.tick);
    if (note) {
      results.push({ time: note.time, text: textEvent.text, midi: note.midi });
      results.push({
        time: note.time + note.duration,
        text: "",
        midi: note.midi,
      });
      noteTicks.delete(textEvent.tick);
    } else {
      noNoteTicks.push(textEvent.tick);
    }
  }
  if (noNoteTicks.length > 0) {
    return R.fail({
      type: "noNote",
      positions: noNoteTicks.map((tick) =>
        ticksToPosition(tonejsMidi.header, tick),
      ),
    });
  }
  if (noteTicks.size > textEvents.length) {
    return R.fail({
      type: "excessiveTextEvents",
      positions: Array.from(noteTicks).map((tick) =>
        ticksToPosition(tonejsMidi.header, tick),
      ),
    });
  }
  results.sort((a, b) => {
    if (a.time !== b.time) {
      return a.time - b.time;
    }
    return a.text.length - b.text.length;
  });
  for (let i = results.length - 2; i >= 0; i--) {
    if (results[i].text !== "") {
      continue;
    }
    if (results[i].time !== results[i + 1].time) {
      continue;
    }
    if (results[i].midi === results[i + 1].midi) {
      results.splice(i, 1);
    }
  }
  for (let i = 0; i < results.length - 1; i++) {
    if (results[i].time + epsilon < results[i + 1].time) {
      continue;
    }
    // When empty line comes before lyrics, advance the empty line instead of delaying the lyrics
    // But only if it doesn't create a new overlap with the previous element
    const canAdvanceEmptyLine =
      results[i].text === "" &&
      results[i + 1].text !== "" &&
      (i === 0 ||
        results[i - 1].time + epsilon < results[i + 1].time - epsilon);
    if (canAdvanceEmptyLine) {
      results[i].time = results[i + 1].time - epsilon;
    } else {
      results[i + 1].time = results[i].time + epsilon;
    }
  }
  results.splice(results.length - 1, 1);

  return R.succeed(
    results.map((r) => ({
      time: r.time,
      text: r.text,
    })),
  );
}

export type Position = {
  measure: number;
  beat: number;
  tick: number;
};

function ticksToPosition(header: Header, ticks: number): Position {
  if (ticks < 0) {
    throw new Error("Ticks cannot be negative");
  }
  let measure = 0;

  const timeSignatures = header.timeSignatures;
  for (let i = 0; i < timeSignatures.length; i++) {
    const ts = {
      ticks: timeSignatures[i].ticks,
      numerator: timeSignatures[i].timeSignature[0],
      denominator: timeSignatures[i].timeSignature[1],
    };
    const nextTs = timeSignatures[i + 1];
    const ticksPerMeasure = (header.ppq * 4 * ts.numerator) / ts.denominator;

    for (
      let currentTick = ts.ticks;
      currentTick < (nextTs ? nextTs.ticks : Infinity);
      currentTick += ticksPerMeasure
    ) {
      if (ticks < currentTick + ticksPerMeasure) {
        const remainingTicks = ticks - currentTick;
        const beat =
          Math.floor((remainingTicks / header.ppq) % ts.numerator) + 1;
        const tick = remainingTicks % header.ppq;
        return { measure, beat, tick };
      }
      measure++;
    }
  }

  throw new Error("Could not convert ticks to position");
}
