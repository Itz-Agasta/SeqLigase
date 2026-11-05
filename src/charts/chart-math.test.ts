/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import type { ExperimentsData } from "@/engine/types";
import { curveDomain, MODEL_COLORS, modelColor, resolveBrush } from "./chart-math";

const data = JSON.parse(readFileSync("public/data/experiments.json", "utf8")) as ExperimentsData;

describe("resolveBrush", () => {
  it("ignores a drag narrower than three epochs", () => {
    expect(resolveBrush(10, 12, [1, 40])).toBeNull();
  });
  it("zooms to a wider drag, in either direction", () => {
    expect(resolveBrush(20, 8, [1, 40])).toEqual([8, 20]);
  });
  it("clamps to the domain", () => {
    expect(resolveBrush(-5, 90, [1, 40])).toEqual([1, 40]);
  });
});

describe("modelColor", () => {
  it("stays fixed to the model regardless of what is shown", () => {
    const before = modelColor("LSTM");
    expect(modelColor("LSTM")).toBe(before);
    expect(new Set(Object.values(MODEL_COLORS)).size).toBe(4);
  });
});

describe("curveDomain", () => {
  it("covers only visible series inside the zoomed range", () => {
    const points = [
      { epoch: 1, mean: 0.2, lo: 0.1, hi: 0.3 },
      { epoch: 2, mean: 0.8, lo: 0.7, hi: 0.9 },
    ];
    expect(curveDomain([points], [2, 2])).toEqual([0.7, 0.9]);
  });
  it("has a usable default with nothing visible", () => {
    expect(curveDomain([], [1, 40])).toEqual([0, 1]);
  });
});

describe("experiment data", () => {
  it("has histogram bins that sum to the valid count", () => {
    expect(data.tanimoto.bins.reduce((a, b) => a + b, 0)).toBe(1944);
    expect(data.tanimoto.valid).toBe(1944);
  });
  it("uses one number for a metric across charts and table", () => {
    for (const split of [data.splits.random, data.splits.scaffold]) {
      const row = (model: string, mask = "15%") =>
        split.table.find((r) => r.model === model && r.mask === mask)!;
      ["BiLSTM", "LSTM", "ChemBERTa", "T5"].forEach((model, i) => {
        expect(row(model).values[0]).toBe(split.compare.acc.values[i]);
        expect(row(model).values[1]).toBe(split.compare.top3.values[i]);
        expect(row(model).values[2]).toBe(split.compare.exact.values[i]);
        expect(row(model).values[3]).toBe(split.compare.valid.values[i]);
      });
      expect(split.sweep.BiLSTM[0]).toBe(row("BiLSTM").values[0]);
      expect(split.sweep.BiLSTM[1]).toBe(row("BiLSTM", "25%").values[0]);
      expect(split.sweep.BiLSTM[2]).toBe(row("BiLSTM", "35%").values[0]);
    }
  });
  it("has confusion rows that sum to one", () => {
    for (const row of data.confusion.matrix)
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
  });
});
