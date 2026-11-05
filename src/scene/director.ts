import gsap from "gsap";
import * as THREE from "three";
import type { MoleculeRecord, ReconstructResponse, TokenCandidate } from "@/engine/types";
import { applyLook, type AtomHandle, type BuiltMolecule } from "./build-molecule";
import { DEFAULT_LOOK, HIDDEN_LOOK } from "./look";
import type { Rig } from "./moment-rig";

export const PHASE_TIMES = { damage: 2, reading: 3.6, ligation: 2.6, verify: 1.4 };
export type Phase = keyof typeof PHASE_TIMES;

export interface DisplayedToken {
  token: string;
  p: number;
  locked: boolean;
  alts?: TokenCandidate[];
}

export interface DirectorInput {
  rig: Rig;
  camera: THREE.Camera;
  response: ReconstructResponse;
  record: MoleculeRecord;
  reducedMotion: boolean;
  onPhase: (phase: Phase) => void;
  onDisplay: (display: Record<number, DisplayedToken>) => void;
  onSwap: () => void;
  onBeam: (progress: number | null) => void;
  onChecks: (checks: string[]) => void;
}

export interface Playback {
  finished: Promise<void>;
  skip: () => void;
}

const FLICKER = ["[C]", "[=C]", "[N]", "[O]", "[=O]", "[F]", "[#C]", "[Ring1]", "[Branch1]"];

function goneAtoms(record: MoleculeRecord, mask: number[]) {
  const gone = new Set<number>();
  for (const t of mask) {
    const atom = record.atomTokens.indexOf(t);
    if (atom >= 0) gone.add(atom);
  }
  for (const { a, b } of record.bonds) {
    if (record.atoms[a].el === "H" && gone.has(b)) gone.add(a);
    if (record.atoms[b].el === "H" && gone.has(a)) gone.add(b);
  }
  return gone;
}

function goneBonds(record: MoleculeRecord, mask: number[]) {
  return new Set(
    mask.map((t) => record.tokenBond[String(t)]).filter((b): b is number => b !== undefined),
  );
}

function goneInAfter(after: BuiltMolecule, mask: Set<number>) {
  const gone = new Set<number>();
  for (const a of after.atoms)
    if (a.tokenIndex !== null && mask.has(a.tokenIndex)) gone.add(a.index);
  for (const { a, b } of after.structure.bonds) {
    if (after.structure.atoms[a].el === "H" && gone.has(b)) gone.add(a);
    if (after.structure.atoms[b].el === "H" && gone.has(a)) gone.add(b);
  }
  return gone;
}

export function createDirector(input: DirectorInput) {
  let current: Playback | null = null;

  function play(): Playback {
    if (current) return current;
    const { rig, response, record, reducedMotion, onPhase, onDisplay, onSwap, onBeam, onChecks } =
      input;
    const mask = response.mask_positions;
    const topOf = (t: number) => response.topk[String(t)][0];
    const lockedAll = () =>
      Object.fromEntries(
        mask.map((t) => [t, { token: topOf(t).token, p: topOf(t).p, locked: true }]),
      );
    const checks = [
      "SELFIES decoded",
      response.valid ? "RDKit sanitised" : "RDKit rejected the structure",
      `Tanimoto ${response.tanimoto_similarity.toFixed(3)}`,
    ];

    let resolve: () => void = () => undefined;
    const finished = new Promise<void>((r) => (resolve = r));

    if (reducedMotion) {
      const timer = setTimeout(done, 350);
      onPhase("verify");
      onDisplay(lockedAll());
      rig.before.group.visible = false;
      rig.after.group.visible = true;
      applyLook(rig.after, DEFAULT_LOOK);
      onSwap();
      current = { finished, skip: done };
      function done() {
        clearTimeout(timer);
        resolve();
      }
      return current;
    }

    const {
      before,
      after,
      clouds,
      pulses,
      flashes,
      shocks,
      rings,
      marks,
      scan,
      dust,
      camera: cs,
      framing,
      state,
    } = rig;
    const maskSet = new Set(mask);
    const gone = goneAtoms(record, mask);
    const bonds = goneBonds(record, mask);
    const heroDistance = framing.fitDistance * 0.62;
    const hole = framing.hole.clone().multiplyScalar(0.6);
    const hero = hole.clone().addScaledVector(framing.dir, heroDistance);
    const camera = input.camera.position;
    const startSide = camera.dot(framing.dir) < 0 ? -1 : 1;
    if (startSide < 0) hero.copy(hole).addScaledVector(framing.dir, -heroDistance);
    Object.assign(cs, { x: camera.x, y: camera.y, z: camera.z });
    const endDir = hero.clone().sub(hole).normalize();
    const wide = endDir.clone().multiplyScalar(framing.fitDistance * 0.78);

    const tl = gsap.timeline({ paused: true });
    const T = {
      reading: PHASE_TIMES.damage,
      ligation: PHASE_TIMES.damage + PHASE_TIMES.reading,
      verify: PHASE_TIMES.damage + PHASE_TIMES.reading + PHASE_TIMES.ligation,
    };
    const end = T.verify + PHASE_TIMES.verify;

    // Damage
    tl.call(() => onPhase("damage"), undefined, 0);
    // The shells fall away first, so everyone can see the hole being made.
    tl.to(before.shellUniforms.uAlpha, { value: 0, duration: 0.3 }, 0);
    tl.to(before.shellUniforms.uSolid, { value: 0, duration: 0.3 }, 0);
    tl.call(() => applyLook(before, HIDDEN_LOOK), undefined, 0.32);
    tl.to(dust.uniforms.uB, { value: 0.5, duration: 1.2 }, 0);
    tl.to(
      cs,
      {
        x: hero.x,
        y: hero.y,
        z: hero.z,
        tx: hole.x,
        ty: hole.y,
        tz: hole.z,
        duration: 1.9,
        ease: "power2.inOut",
      },
      0.02,
    );
    tl.call(() => (state.shake = 0.09), undefined, 0.25);
    clouds.forEach((c, k) => {
      const at = 0.25 + k * 0.1;
      tl.call(
        () => {
          c.points.visible = true;
          c.uniforms.uB.value = 1.8;
          const atom =
            c.source.atomIndex === null
              ? undefined
              : before.atoms.find((a) => a.index === c.source.atomIndex);
          if (atom) atom.mesh.visible = false;
        },
        undefined,
        at,
      );
      tl.to(c.uniforms.uD, { value: 1, duration: 1.4, ease: "power2.out" }, at);
      tl.to(c.uniforms.uB, { value: 0.32, duration: 1.4, ease: "power2.out" }, at + 0.1);
    });
    before.atoms.forEach((a) => {
      if (gone.has(a.index) && a.el === "H") {
        tl.to(
          a.mesh.scale,
          { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, ease: "power2.in" },
          0.25,
        );
      }
    });
    before.halves.forEach((h) => {
      const ownGone = gone.has(h.owner) || bonds.has(h.bond);
      const otherGone = gone.has(h.other);
      if (gone.has(h.owner)) {
        tl.to(h.group.scale, { y: 0.001, duration: 0.22, ease: "power2.in" }, 0.25);
      } else if (otherGone || ownGone) {
        tl.fromTo(
          h.material,
          { emissiveIntensity: 2.6 },
          { emissiveIntensity: 0, duration: 1.1, ease: "power2.out" },
          0.25,
        );
        tl.to(
          h.group.scale,
          {
            y: h.kind === "inner" ? 0.001 : bonds.has(h.bond) ? 0.45 : 0.82,
            duration: 0.5,
            ease: "back.out(2.2)",
          },
          0.25,
        );
      }
    });
    tl.to(state, { bloom: 0.8, duration: 0.1 }, 0.25).to(
      state,
      { bloom: 0.42, duration: 0.8 },
      0.37,
    );
    tl.to(
      rings.map((r) => r.material),
      { opacity: 0.75, duration: 0.5 },
      1.25,
    ).to(
      marks.map((m) => m.material),
      { opacity: 0.85, duration: 0.5 },
      1.4,
    );

    // Reading
    tl.call(() => onPhase("reading"), undefined, T.reading);
    const flicker = { k: 0, last: 0 };
    tl.to(
      flicker,
      {
        k: 1,
        duration: PHASE_TIMES.reading,
        ease: "none",
        onUpdate() {
          const now = performance.now();
          if (now - flicker.last < 70) return;
          flicker.last = now;
          const k = flicker.k;
          const display: Record<number, DisplayedToken> = {};
          for (const t of mask) {
            const top = topOf(t);
            const settled = k > 0.72 && Math.random() < k;
            const list = response.topk[String(t)].slice(0, 3);
            const conf = 0.2 + k * (top.p - 0.2) + (1 - k) * Math.random() * 0.16;
            display[t] = {
              token: settled ? top.token : FLICKER[Math.floor(Math.random() * FLICKER.length)],
              p: conf,
              locked: false,
              alts: list.map((c, i) => ({
                token: c.token,
                p: i === 0 ? conf : c.p + (1 - k) * Math.random() * 0.2,
              })),
            };
          }
          onDisplay(display);
        },
      },
      T.reading,
    );
    tl.to(
      cs,
      {
        z: hero.z - endDir.z * 1.1,
        x: hero.x - endDir.x * 1.1,
        y: hero.y - endDir.y * 1.1,
        duration: PHASE_TIMES.reading,
        ease: "none",
      },
      T.reading,
    );
    tl.to(
      state,
      { swirlSpeed: 3.2, duration: PHASE_TIMES.reading - 0.3, ease: "power2.in" },
      T.reading,
    );
    tl.to(state, { bloom: 0.72, duration: PHASE_TIMES.reading - 0.3 }, T.reading);
    const brand = new THREE.Color(rig.palette.brand).multiplyScalar(1.4);
    clouds.forEach((c) => {
      tl.to(
        c.uniforms.uTi,
        { value: 0.46, duration: PHASE_TIMES.reading - 0.3, ease: "power2.in" },
        T.reading,
      );
      tl.to(
        c.uniforms.uB,
        { value: 1.3, duration: PHASE_TIMES.reading - 0.3, ease: "power1.in" },
        T.reading,
      );
      tl.to(
        c.uniforms.uCol.value,
        { r: brand.r, g: brand.g, b: brand.b, duration: 1.6 },
        T.reading + 0.3,
      );
    });
    tl.to(
      rings.map((r) => r.material),
      { opacity: 0.25, duration: 0.8 },
      T.reading + 0.4,
    );
    tl.to(
      marks.map((m) => m.material),
      { opacity: 0, duration: 0.5 },
      T.reading + 0.15,
    );
    [0, 1].forEach((pass) => {
      const p = { f: 0 };
      tl.to(
        p,
        {
          f: 1,
          duration: 1.5,
          ease: "sine.inOut",
          onStart: () => onBeam(0),
          onUpdate() {
            pulses.forEach((pulse) => pulse.set(p.f));
            onBeam(p.f);
            pulses.forEach((pulse) => {
              pulse.path.atoms.forEach((atomIndex, j) => {
                const handle = before.atoms.find((a) => a.index === atomIndex);
                const material = handle?.mesh.material as THREE.MeshPhysicalMaterial | undefined;
                if (material)
                  material.emissiveIntensity = Math.max(
                    0,
                    1.6 - Math.abs(p.f * pulse.path.atoms.length - j) * 2.2,
                  );
              });
            });
          },
          onComplete() {
            pulses.forEach((pulse) => pulse.off());
            onBeam(null);
            before.atoms.forEach((a) => {
              const material = a.mesh.material as THREE.MeshPhysicalMaterial;
              if ("emissiveIntensity" in material) material.emissiveIntensity = 0;
            });
          },
        },
        T.reading + 0.05 + pass * 1.72,
      );
    });

    // Ligation
    tl.call(() => onPhase("ligation"), undefined, T.ligation);
    const closer = hero.clone().addScaledVector(endDir, -1.9);
    tl.to(
      cs,
      { x: closer.x, y: closer.y, z: closer.z, duration: 0.42, ease: "power3.in" },
      T.ligation,
    );
    tl.to(
      rings.map((r) => r.material),
      { opacity: 0, duration: 0.25 },
      T.ligation,
    );
    tl.to(state, { swirlSpeed: 0.1, duration: 0.5 }, T.ligation + 0.2);

    const afterGone = goneInAfter(after, maskSet);
    const firstHit = T.ligation + 0.12 + 0.46;
    tl.call(
      () => {
        before.group.visible = false;
        after.group.visible = true;
        onSwap();
        after.atoms.forEach((a) => {
          if (afterGone.has(a.index)) a.mesh.scale.setScalar(0.001);
        });
        after.halves.forEach((h) => {
          if (afterGone.has(h.owner)) h.group.scale.y = 0.001;
          else if (afterGone.has(h.other)) h.group.scale.y = h.kind === "inner" ? 0.001 : 0.82;
        });
      },
      undefined,
      firstHit - 0.02,
    );

    const targetFor = (tokens: number[]): AtomHandle | undefined =>
      after.atoms.find((a) => a.tokenIndex !== null && tokens.includes(a.tokenIndex));
    const locks: Record<number, DisplayedToken> = {};
    clouds.forEach((c, k) => {
      const at = T.ligation + 0.12 + k * 0.3;
      const hit = at + 0.46;
      const target = targetFor(c.source.tokens);
      if (target) c.points.position.copy(target.position);
      tl.to(c.uniforms.uC, { value: 1, duration: 0.46, ease: "power3.in" }, at);
      tl.to(c.uniforms.uB, { value: 3.4, duration: 0.46, ease: "power2.in" }, at);
      tl.call(
        () => {
          c.points.visible = false;
          state.shake = 0.26;
          shocks[k].visible = true;
          shocks[k].material.opacity = 1;
          (dust.uniforms.uO.value as THREE.Vector3).copy(c.points.position);
          for (const t of c.source.tokens)
            locks[t] = { token: topOf(t).token, p: topOf(t).p, locked: true };
          onDisplay({ ...locks });
        },
        undefined,
        hit,
      );
      flashes[k].position.copy(c.points.position);
      shocks[k].position.copy(c.points.position);
      tl.fromTo(
        flashes[k].scale,
        { x: 0.1, y: 0.1 },
        { x: 5.6, y: 5.6, duration: 0.34, ease: "power2.out" },
        hit,
      );
      tl.fromTo(
        flashes[k].material,
        { opacity: 1 },
        { opacity: 0, duration: 0.72, ease: "power2.out" },
        hit,
      );
      tl.fromTo(
        shocks[k].scale,
        { x: 0.2, y: 0.2, z: 0.2 },
        { x: 9.5, y: 9.5, z: 9.5, duration: 1.25, ease: "expo.out" },
        hit,
      );
      tl.to(shocks[k].material, { opacity: 0, duration: 1.1, ease: "power2.out" }, hit + 0.1);
      tl.fromTo(state, { bloom: 1.55 }, { bloom: 0.42, duration: 1.2, ease: "power2.out" }, hit);
      if (target) {
        const material = target.mesh.material as THREE.MeshPhysicalMaterial;
        tl.to(
          target.mesh.scale,
          {
            x: target.radius,
            y: target.radius,
            z: target.radius,
            duration: 0.72,
            ease: "elastic.out(1.15,.42)",
          },
          hit,
        );
        tl.fromTo(
          material,
          { emissiveIntensity: 2.8 },
          { emissiveIntensity: 0.18, duration: 1.6, ease: "power2.out" },
          hit,
        );
      }
      if (k === 0) {
        tl.fromTo(
          dust.uniforms.uWA,
          { value: 0.95 },
          { value: 0, duration: 1.5, ease: "power2.out" },
          hit,
        );
        tl.fromTo(
          dust.uniforms.uW,
          { value: 0 },
          { value: 18, duration: 1.5, ease: "power1.out" },
          hit,
        );
        tl.to(dust.uniforms.uB, { value: 1, duration: 0.8 }, hit);
      }
    });

    // Atoms the prediction added that no cloud targeted, then the bonds and hydrogens.
    after.atoms.forEach((a) => {
      if (!afterGone.has(a.index)) return;
      const delay = a.el === "H" ? 0.62 : 0.3;
      tl.to(
        a.mesh.scale,
        { x: a.radius, y: a.radius, z: a.radius, duration: 0.5, ease: "back.out(2.6)" },
        firstHit + delay,
      );
    });
    after.halves.forEach((h) => {
      if (!afterGone.has(h.owner) && !afterGone.has(h.other)) return;
      const isHydrogen =
        after.structure.atoms[h.owner].el === "H" || after.structure.atoms[h.other].el === "H";
      const at = firstHit + (isHydrogen ? 0.56 : 0.16);
      tl.to(h.group.scale, { y: 1, duration: 0.42, ease: "power3.out" }, at);
      const rest = h.material.emissiveIntensity;
      tl.fromTo(
        h.material,
        { emissiveIntensity: 3.2 },
        { emissiveIntensity: rest, duration: 1.4, ease: "power2.out" },
        at,
      );
    });

    tl.to(
      cs,
      { x: wide.x, y: wide.y, z: wide.z, tx: 0, ty: 0, tz: 0, duration: 1.5, ease: "expo.out" },
      T.ligation + 1.05,
    );

    // The surface heals outward from the repair.
    const healAt = firstHit + 1;
    const origin = clouds[0]?.points.position ?? new THREE.Vector3();
    const byDistance = [...after.shells].sort(
      (a, b) => a.position.distanceTo(origin) - b.position.distanceTo(origin),
    );
    tl.call(
      () => {
        after.shells.forEach((shell) => {
          shell.group.visible = true;
          shell.group.scale.setScalar(0.2);
        });
      },
      undefined,
      healAt - 0.01,
    );
    tl.to(
      after.shellUniforms.uAlpha,
      { value: DEFAULT_LOOK.shell, duration: 0.9, ease: "power2.out" },
      healAt,
    );
    byDistance.forEach((shell, i) => {
      tl.to(
        shell.group.scale,
        { x: 1, y: 1, z: 1, duration: 0.7, ease: "back.out(1.6)" },
        healAt + i * 0.035,
      );
    });

    // Verify
    tl.call(
      () => {
        onPhase("verify");
        onDisplay(lockedAll());
        onChecks([]);
      },
      undefined,
      T.verify,
    );
    const extent = Math.max(...after.atoms.map((a) => a.position.length())) + 0.7;
    scan.scale.set(extent * 2.6, 0.035, 1);
    tl.set(scan.position, { x: 0, y: extent, z: 0 }, T.verify);
    tl.fromTo(scan.material, { opacity: 0 }, { opacity: 0.9, duration: 0.15 }, T.verify);
    tl.to(scan.position, { y: -extent, duration: 1, ease: "sine.inOut" }, T.verify);
    tl.to(scan.material, { opacity: 0, duration: 0.15 }, T.verify + 0.9);
    tl.to(
      cs,
      {
        x: endDir.x * framing.fitDistance,
        y: endDir.y * framing.fitDistance,
        z: endDir.z * framing.fitDistance,
        duration: 0.7,
        ease: "power2.inOut",
      },
      end - 0.7,
    );
    checks.forEach((_, i) =>
      tl.call(() => onChecks(checks.slice(0, i + 1)), undefined, T.verify + 0.2 + i * 0.3),
    );
    tl.set({}, {}, end);

    const onHide = () => {
      if (document.visibilityState === "hidden") skip();
    };
    function skip() {
      if (tl.progress() < 1) tl.progress(1);
    }
    tl.eventCallback("onComplete", () => {
      document.removeEventListener("visibilitychange", onHide);
      pulses.forEach((pulse) => pulse.off());
      onBeam(null);
      resolve();
    });
    document.addEventListener("visibilitychange", onHide);
    tl.play();
    current = { finished, skip };
    return current;
  }

  return { play };
}
