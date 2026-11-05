import { describe, expect, it } from "vite-plus/test";
import {
  clampSelection,
  DEFAULT_SELECTION,
  parseLabSearch,
  serializeLabSearch,
  syncSearch,
} from "./url-state";

const known = new Set(["phenol", "aniline"]);

describe("lab URL state", () => {
  it("uses defaults with no params", () => {
    expect(parseLabSearch(new URLSearchParams(""), known)).toEqual(DEFAULT_SELECTION);
  });

  it("reads a full selection", () => {
    const s = parseLabSearch(
      new URLSearchParams("mol=aniline&model=gru&start=0&len=3&seed=9"),
      known,
    );
    expect(s).toEqual({ moleculeId: "aniline", model: "GRU", start: 0, length: 3, seed: 9 });
  });

  it("falls back on an unknown molecule", () => {
    const s = parseLabSearch(new URLSearchParams("mol=aspirin&start=1&len=1"), known);
    expect(s.moleculeId).toBe("phenol");
    expect(s.start).toBe(DEFAULT_SELECTION.start);
  });

  it("falls back on an unknown model, a negative seed and bad spans", () => {
    const s = parseLabSearch(new URLSearchParams("model=gpt&seed=-4&start=-1&len=9"), known);
    expect(s.model).toBe("BiLSTM");
    expect(s.seed).toBe(1337);
    expect(s.start).toBe(DEFAULT_SELECTION.start);
    expect(s.length).toBe(DEFAULT_SELECTION.length);
  });

  it("picks a mask later when a molecule has no span given", () => {
    expect(parseLabSearch(new URLSearchParams("mol=aniline"), known).start).toBeNull();
  });

  it("clamps a span past the end of the sequence", () => {
    expect(clampSelection({ ...DEFAULT_SELECTION, start: 40, length: 3 }, 9)).toMatchObject({
      start: 6,
      length: 3,
    });
    expect(clampSelection({ ...DEFAULT_SELECTION, start: 0, length: 3 }, 2)).toMatchObject({
      start: 0,
      length: 2,
    });
  });

  it("round-trips", () => {
    const sel = { moleculeId: "aniline", model: "RNN", start: 2, length: 1, seed: 5 } as const;
    expect(parseLabSearch(new URLSearchParams(serializeLabSearch(sel)), known)).toEqual(sel);
  });
});

describe("syncSearch", () => {
  const sel = { moleculeId: "aniline", model: "RNN", start: 2, length: 1, seed: 5 } as const;
  it("keeps a quality setting from the current URL", () => {
    expect(new URLSearchParams(syncSearch(sel, "?quality=low&mol=phenol")).get("quality")).toBe(
      "low",
    );
  });
  it("adds nothing when the URL has no quality setting", () => {
    expect(syncSearch(sel, "?mol=phenol")).toBe(serializeLabSearch(sel));
  });
});
