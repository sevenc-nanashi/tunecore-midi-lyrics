import { test, expect, describe } from "bun:test";
import { midiToLyrics } from "../src/midi.ts";
import { R } from "@praha/byethrow";

describe("midi", () => {
  test("can parse midi", async () => {
    const midiData = await Bun.file("tests/fixtures/01.mid").arrayBuffer();
    const parsed = midiToLyrics(new Uint8Array(midiData));
    expect(R.unwrap(parsed)).toMatchSnapshot();
  });
});
