/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import type { MoleculeRecord } from "@/engine/types";
import { applyLook, buildMolecule } from "./build-molecule";
import type { ScenePalette } from "./colors";
import { DEFAULT_LOOK } from "./look";

const palette: ScenePalette = {
  C: "#999999",
  H: "#eeeeee",
  O: "#ee0000",
  N: "#0000ee",
  F: "#00ee00",
  brand: "#6666ff",
  warn: "#ffaa00",
  muted: "#aaaaaa",
};
const phenol = JSON.parse(
  readFileSync("public/data/molecules/phenol.json", "utf8"),
) as MoleculeRecord;
const build = (view: "original" | "masked" | "reconstructed" | "overlay", shells = true) =>
  buildMolecule({
    record: phenol,
    response: phenol.runs["BiLSTM:4:2"],
    view,
    mask: [4, 5],
    showHydrogens: true,
    palette,
    shells,
  });

describe("atom shells", () => {
  it("gives every atom a shell at its van der Waals radius", () => {
    const b = build("original");
    expect(b.shells).toHaveLength(phenol.atoms.length);
    const oxygen = b.shells.find((s) => s.index === 0);
    expect(oxygen?.radius).toBe(1.52);
  });

  it("leaves a gap where atoms are masked", () => {
    const b = build("masked");
    const heavyMasked = [4, 5];
    expect(b.shells.some((s) => heavyMasked.includes(s.index))).toBe(false);
  });

  it("has none in the overlay, which draws its own", () => {
    expect(build("overlay").shells).toHaveLength(0);
  });

  it("can be turned off for small viewports", () => {
    expect(build("original", false).shells).toHaveLength(0);
  });

  it("applies a look to shells, labels and bond lengths", () => {
    const b = build("original");
    applyLook(b, { solid: 0.5, shell: 0.3, labels: 1, lengths: 1 });
    expect(b.shellUniforms.uSolid.value).toBe(0.5);
    expect(b.shellUniforms.uAlpha.value).toBe(0.3);
    expect(b.carbonLabels.every((l) => l.material.opacity === 1)).toBe(true);
    expect(b.lengthLabels.length).toBeGreaterThan(0);
    expect(b.lengthLabels.every((l) => l.material.opacity === 1)).toBe(true);
    applyLook(b, DEFAULT_LOOK);
    expect(b.lengthLabels.every((l) => !l.visible)).toBe(true);
  });

  it("frames the molecule including its shells", () => {
    const b = build("original");
    const furthest = Math.max(...b.shells.map((s) => s.position.length() + s.radius));
    expect(b.radius).toBeGreaterThanOrEqual(furthest - 0.8);
  });

  it("feeds real atoms to the occlusion", () => {
    const b = build("original");
    expect(b.aoUniforms.uCount.value).toBe(phenol.atoms.length);
  });
});
