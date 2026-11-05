import { describe, expect, it } from "vite-plus/test";
import { formatChange, propertyRows, verdictOf } from "./format";

const props = { mol_weight: 93.13, logp: 1.27, hbd: 1, hba: 1 };
const after = { mol_weight: 94.11, logp: 1.15, hbd: 1, hba: 2 };

describe("formatChange", () => {
  it("adds a sign", () => {
    expect(formatChange(93.13, 94.11, 2)).toBe("+0.98");
    expect(formatChange(1.27, 1.15, 2)).toBe("−0.12");
  });
  it("shows plain zero when unchanged", () => {
    expect(formatChange(1, 1, 0)).toBe("0");
    expect(formatChange(93.13, 93.13, 2)).toBe("0");
  });
});

describe("propertyRows", () => {
  it("shows dashes while stale", () => {
    const rows = propertyRows(props, null);
    expect(rows[0]).toEqual({
      label: "Mol. weight",
      original: "93.13",
      predicted: "–",
      change: "–",
    });
  });
  it("fills in a result", () => {
    const rows = propertyRows(props, after);
    expect(rows[3]).toEqual({
      label: "H-bond acceptors",
      original: "1",
      predicted: "2",
      change: "+1",
    });
  });
});

describe("verdictOf", () => {
  it("names exact and partial recovery", () => {
    expect(verdictOf({ exact_recovery: true, valid: true })).toEqual({
      tone: "good",
      text: "Exact recovery",
    });
    expect(verdictOf({ exact_recovery: false, valid: true })).toEqual({
      tone: "warn",
      text: "Partial: valid molecule, different from original",
    });
  });
  it("names an invalid result", () => {
    expect(verdictOf({ exact_recovery: false, valid: false })).toEqual({
      tone: "warn",
      text: "Invalid: the sequence didn't decode to a molecule",
    });
  });
});
