import { Header, Midi } from "@tonejs/midi";
import { parseMidi } from "midi-file";
import { R } from "@praha/byethrow";

const epsilon = 1e-6;

export type ConvertError =
  | {
      type: "noNote";
      positions: Position[];
    }
  | {
      type: "overlappingNotes";
      positions: Position[];
    };

export type LyricEvent = { time: number; text: string };
export function midiToLyrics(
  data: Uint8Array,
): R.Result<LyricEvent[], ConvertError> {
  const tonejsMidi = new Midi(data);
  const midiEvents = parseMidi(data);
  const textEvents: { tick: number; text: string }[] = [];
  for (const track of midiEvents.tracks) {
    let currentTick = 0;
    for (const event of track) {
      currentTick += event.deltaTime;
      if (event.type === "text") {
        const reencodedText = new TextDecoder().decode(
          new Uint8Array(event.text.split("").map((c) => c.charCodeAt(0))),
        );
        textEvents.push({ tick: currentTick, text: reencodedText });
      }
    }
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

  const unusedTicks: number[] = [];
  for (const textEvent of textEvents) {
    const note = notes.find((n) => n.ticks === textEvent.tick);
    if (note) {
      results.push({ time: note.time, text: textEvent.text, midi: note.midi });
      results.push({
        time: note.time + note.duration,
        text: "",
        midi: note.midi,
      });
    } else {
      unusedTicks.push(textEvent.tick);
    }
  }
  if (unusedTicks.length > 0) {
    return R.fail({
      type: "noNote",
      positions: unusedTicks.map((tick) =>
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
