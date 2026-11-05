/// <reference types="node" />
import { readFileSync } from "node:fs";
import gsap from "gsap";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { MoleculeRecord } from "@/engine/types";
import { buildMolecule } from "./build-molecule";
import type { ScenePalette } from "./colors";
import { createDirector, PHASE_TIMES } from "./director";
import { DEFAULT_LOOK } from "./look";
import { createRig, findPulsePaths, findSources } from "./moment-rig";

const palette: ScenePalette = {
  C: "#999",
  H: "#eee",
  O: "#e00",
  N: "#00e",
  F: "#0e0",
  brand: "#66f",
  warn: "#fa0",
  muted: "#aaa",
};
const load = (id: string) =>
  JSON.parse(readFileSync(`public/data/molecules/${id}.json`, "utf8")) as MoleculeRecord;

function setup(id = "phenol", key = "BiLSTM:4:2") {
  const record = load(id);
  const response = record.runs[key];
  const build = (view: "original" | "reconstructed") =>
    buildMolecule({
      record,
      response,
      view,
      mask: response.mask_positions,
      showHydrogens: true,
      palette,
    });
  const before = build("original");
  const after = build("reconstructed");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 100);
  camera.position.set(0, 0, 14);
  const rig = createRig({
    scene,
    before,
    after,
    record,
    response,
    palette,
    particles: 50,
    fitDistance: 14,
  });
  const phases: string[] = [];
  const displays: unknown[] = [];
  const swap = vi.fn();
  const callbacks = {
    onPhase: (p: string) => phases.push(p),
    onDisplay: (d: unknown) => displays.push(d),
    onSwap: swap,
    onBeam: () => undefined,
    onChecks: () => undefined,
  };
  return { record, response, rig, camera, phases, displays, swap, callbacks };
}

describe("director", () => {
  beforeEach(() => {
    gsap.globalTimeline.timeScale(400);
  });
  afterEach(() => {
    gsap.globalTimeline.timeScale(1);
  });

  it("has phases that total about ten seconds", () => {
    const total =
      PHASE_TIMES.damage + PHASE_TIMES.reading + PHASE_TIMES.ligation + PHASE_TIMES.verify;
    expect(total).toBeGreaterThanOrEqual(9);
    expect(total).toBeLessThanOrEqual(11);
  });

  it("runs the phases in order and swaps to the result once", async () => {
    const { rig, camera, phases, swap, callbacks, response, record } = setup();
    await createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: false,
      ...callbacks,
    }).play().finished;
    expect(phases).toEqual(["damage", "reading", "ligation", "verify"]);
    expect(swap).toHaveBeenCalledTimes(1);
  });

  it("fades the shells away, then heals them back and settles on the default look", async () => {
    const { rig, camera, callbacks, response, record } = setup();
    let peak = 0;
    const before: number[] = [];
    const run = createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: false,
      ...callbacks,
      onPhase: (p: string) => {
        if (p === "reading") before.push(rig.before.shellUniforms.uAlpha.value as number);
        callbacks.onPhase(p);
      },
      onChecks: () => {
        peak = Math.max(peak, rig.after.shellUniforms.uAlpha.value as number);
      },
    }).play();
    await run.finished;
    expect(before[0]).toBeLessThan(0.02);
    expect(peak).toBeGreaterThan(0.05);
    expect(rig.after.shellUniforms.uAlpha.value).toBe(DEFAULT_LOOK.shell);
    for (const shell of rig.after.shells) expect(shell.group.scale.x).toBeCloseTo(1, 2);
  });

  it("ends every masked token locked on the predicted token", async () => {
    const { rig, camera, displays, callbacks, response, record } = setup("aniline", "BiLSTM:0:2");
    await createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: false,
      ...callbacks,
    }).play().finished;
    expect(displays.at(-1)).toMatchObject({
      0: { token: "[O]", locked: true },
      1: { token: "[C]", locked: true },
    });
  });

  it("skip lands on the final state and resolves", async () => {
    gsap.globalTimeline.timeScale(1);
    const { rig, camera, phases, swap, callbacks, response, record } = setup();
    const run = createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: false,
      ...callbacks,
    }).play();
    run.skip();
    await run.finished;
    expect(swap).toHaveBeenCalledTimes(1);
    expect(phases.at(-1)).toBe("verify");
  });

  it("reduced motion has no flash and resolves quickly", async () => {
    gsap.globalTimeline.timeScale(1);
    const { rig, camera, swap, callbacks, response, record } = setup();
    const started = performance.now();
    await createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: true,
      ...callbacks,
    }).play().finished;
    expect(performance.now() - started).toBeLessThan(1000);
    expect(swap).toHaveBeenCalledTimes(1);
    expect(rig.flashes.every((f) => (f.material as THREE.SpriteMaterial).opacity === 0)).toBe(true);
  });

  it("a hidden tab lands on the result", async () => {
    gsap.globalTimeline.timeScale(1);
    const { rig, camera, swap, callbacks, response, record } = setup();
    const run = createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: false,
      ...callbacks,
    }).play();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await run.finished;
    expect(swap).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("ignores a second play while running", async () => {
    const { rig, camera, phases, callbacks, response, record } = setup();
    const director = createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: false,
      ...callbacks,
    });
    const first = director.play();
    expect(director.play()).toBe(first);
    await first.finished;
    expect(phases.filter((p) => p === "damage")).toHaveLength(1);
  });

  it("handles a mask of structure tokens only", async () => {
    const { rig, camera, phases, callbacks, response, record } = setup("phenol", "BiLSTM:7:2");
    expect(rig.clouds.length).toBeGreaterThan(0);
    await createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: false,
      ...callbacks,
    }).play().finished;
    expect(phases.at(-1)).toBe("verify");
  });
});

describe("rig helpers", () => {
  it("finds the masked atoms as damage sources", () => {
    const record = load("phenol");
    const before = buildMolecule({
      record,
      response: null,
      view: "original",
      mask: [4, 5],
      showHydrogens: true,
      palette,
    });
    expect(findSources(record, before, [4, 5]).map((s) => s.atomIndex)).toEqual([4, 5]);
  });

  it("uses the closure bond as a source for ring tokens", () => {
    const record = load("phenol");
    const before = buildMolecule({
      record,
      response: null,
      view: "original",
      mask: [7, 8],
      showHydrogens: true,
      palette,
    });
    const sources = findSources(record, before, [7, 8]);
    expect(sources).toHaveLength(1);
    expect(sources[0].atomIndex).toBeNull();
  });

  it("routes pulses around masked atoms to the hole from both ends", () => {
    const record = load("phenol");
    const before = buildMolecule({
      record,
      response: null,
      view: "original",
      mask: [4, 5],
      showHydrogens: true,
      palette,
    });
    const [forward, reverse] = findPulsePaths(record, findSources(record, before, [4, 5]));
    expect(forward.atoms[0]).toBe(0);
    expect(forward.atoms).not.toContain(4);
    expect(reverse.atoms).not.toContain(5);
    expect(reverse.atoms[0]).not.toBe(0);
  });
});
