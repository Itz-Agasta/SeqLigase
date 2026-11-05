/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { MODEL_IDS, type MoleculeRecord } from "@/engine/types";
import { summariseCompare } from "./summarise";

const aniline = JSON.parse(
  readFileSync("public/data/molecules/aniline.json", "utf8"),
) as MoleculeRecord;

describe("summariseCompare", () => {
  it("returns one result per model in fixed order", () => {
    const rows = summariseCompare(aniline, 0, 2);
    expect(rows.map((r) => r.model)).toEqual(MODEL_IDS);
  });
  it("reports the verdict and tokens for each model", () => {
    const [first] = summariseCompare(aniline, 0, 2);
    expect(first.verdict.tone).toBe("warn");
    expect(first.tanimoto).toBe(0.375);
    expect(first.correct).toBe(1);
    expect(first.total).toBe(2);
    expect(first.tokens[0]).toEqual({ position: 0, token: "[O]", right: false });
  });
  it("is empty for a span with no runs", () => {
    expect(summariseCompare(aniline, 90, 2)).toEqual([]);
  });
});
