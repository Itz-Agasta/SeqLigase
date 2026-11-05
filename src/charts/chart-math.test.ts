/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import type { ExperimentsData } from "@/engine/types";
import { curveDomain, MODEL_COLORS, modelColor, resolveBrush, spreadLabels } from "./chart-math";

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

describe("spreadLabels", () => {
  it("leaves labels that already fit alone", () => {
    expect(spreadLabels([10, 40], 14)).toEqual([10, 40]);
  });
  it("separates close labels without reordering them", () => {
    const [a, b, c] = spreadLabels([50, 20, 52], 14);
    expect(a).toBeLessThan(c);
    expect(c - a).toBeCloseTo(14, 5);
    expect(a - b).toBeGreaterThanOrEqual(14 - 0.001);
  });
});

describe("experiment data", () => {
  const splits = [data.splits.random, data.splits.scaffold];
  it("uses one number for a metric across charts and table", () => {
    for (const split of splits) {
      const row = (model: string, mask = "15%") =>
        split.table.find((r) => r.model === model && r.mask === mask)!;
      ["T5", "ChemBERTa", "BiLSTM", "LSTM"].forEach((model, i) => {
        expect(row(model).values[0]).toBe(split.compare.acc.values[i]);
        expect(row(model).values[1]).toBe(split.compare.top3.values[i]);
        expect(row(model).values[2]).toBe(split.compare.exact.values[i]);
        expect(row(model).values[3]).toBe(split.compare.valid.values[i]);
      });
      expect(split.sweep.T5[0].value).toBe(row("T5").values[0]);
      expect(split.sweep.T5[1].value).toBe(row("T5", "25%").values[0]);
      expect(split.sweep.T5[2].value).toBe(row("T5", "35%").values[0]);
    }
  });
  it("has confidence intervals that contain the value and stay inside 0 to 1", () => {
    for (const split of splits)
      for (const c of Object.values(split.compare))
        c.values.forEach((v, i) => {
          expect(c.lo[i]).toBeGreaterThanOrEqual(0);
          expect(c.hi[i]).toBeLessThanOrEqual(1);
          expect(c.lo[i]).toBeLessThanOrEqual(v);
          expect(c.hi[i]).toBeGreaterThanOrEqual(v);
        });
  });
  it("gives each model its own scaffold gap", () => {
    const random = data.splits.random.compare.acc.values;
    const scaffold = data.splits.scaffold.compare.acc.values;
    const gaps = random.map((v, i) => (v - scaffold[i]).toFixed(3));
    expect(new Set(gaps).size).toBe(gaps.length);
    gaps.forEach((g) => expect(Number(g)).toBeGreaterThan(0));
  });
  it("has similarity counts that agree with the exact and validity metrics", () => {
    for (const split of splits) {
      const t = split.tanimoto;
      expect(t.exact).toBe(Math.round(split.compare.exact.values[0] * t.total));
      expect(t.valid).toBe(Math.round(split.compare.valid.values[0] * t.total));
      expect(t.exact + t.bins.reduce((a, b) => a + b, 0)).toBe(t.valid);
    }
  });
  it("has confusion rows that sum to one, with Other as the last column", () => {
    for (const split of splits)
      for (const row of split.confusion.matrix) {
        expect(row).toHaveLength(split.confusion.tokens.length + 1);
        expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
      }
  });
});
