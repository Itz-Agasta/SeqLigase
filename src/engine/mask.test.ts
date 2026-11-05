import { describe, expect, it } from "vite-plus/test";
import { pickSpan } from "./mask";

const tokens = ["[O]", "[C]", "[=C]", "[C]", "[=C]", "[C]", "[=C]", "[Ring1]", "[=Branch1]"];

describe("pickSpan", () => {
  it("is deterministic for a seed", () => {
    expect(pickSpan(tokens, 25, 2, 7)).toEqual(pickSpan(tokens, 25, 2, 7));
  });

  it("varies with the seed", () => {
    const starts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => pickSpan(tokens, 25, 2, s).start));
    expect(starts.size).toBeGreaterThan(1);
  });

  it("stays in bounds for every ratio and span", () => {
    for (const ratio of [15, 25, 35] as const) {
      for (const maxSpan of [1, 2, 3] as const) {
        for (let seed = 0; seed < 50; seed++) {
          const { start, length } = pickSpan(tokens, ratio, maxSpan, seed);
          expect(start).toBeGreaterThanOrEqual(0);
          expect(start + length).toBeLessThanOrEqual(tokens.length);
          expect(length).toBeLessThanOrEqual(maxSpan);
          expect(length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("handles a molecule shorter than the span", () => {
    expect(pickSpan(["[C]"], 35, 3, 1)).toEqual({ start: 0, length: 1 });
  });
});
