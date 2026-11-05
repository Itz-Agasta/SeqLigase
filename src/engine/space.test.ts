/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { decodeSpace } from "./space";

const meta = JSON.parse(readFileSync("public/data/space.json", "utf8")) as {
  count: number;
  stride: number;
  formulas: string[];
  catalog: Record<string, number>;
};
const file = readFileSync("public/data/space.bin");
const space = decodeSpace(
  meta,
  file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
);

describe("chemical space data", () => {
  it("decodes 20,000 points with finite coordinates", () => {
    expect(space.count).toBe(20000);
    expect(space.points).toHaveLength(80000);
    expect(space.points.every(Number.isFinite)).toBe(true);
  });
  it("has a formula for every point", () => {
    expect(space.formulas).toHaveLength(20000);
  });
  it("resolves catalog molecules to valid points", () => {
    expect(Object.keys(space.catalog).length).toBeGreaterThanOrEqual(30);
    for (const index of Object.values(space.catalog)) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(20000);
    }
    expect(space.formulas[space.catalog.phenol]).toBe("C6H6O");
  });
  it("rejects a file of the wrong length", () => {
    expect(() => decodeSpace(meta, new ArrayBuffer(16))).toThrow(/space/i);
  });
});
