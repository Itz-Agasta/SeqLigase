import * as THREE from "three";
import type { Atom, Bond, MoleculeRecord, ReconstructResponse } from "@/engine/types";
import type { LabView } from "@/state/lab-store";
import { candidateOf } from "./candidate";
import type { ScenePalette } from "./colors";
import { bondSegments, centroid, position, type Vec3 } from "./geometry";

export interface AtomHandle {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial>;
  index: number;
  el: string;
  tokenIndex: number | null;
  radius: number;
  position: THREE.Vector3;
}

export interface HalfHandle {
  group: THREE.Group;
  material: THREE.MeshPhysicalMaterial;
  owner: number;
  other: number;
  kind: "main" | "inner";
  bond: number;
}

export interface BuiltMolecule {
  group: THREE.Group;
  atoms: AtomHandle[];
  halves: HalfHandle[];
  billboards: THREE.Object3D[];
  pulses: THREE.Object3D[];
  radius: number;
  structure: { atoms: Atom[]; bonds: Bond[] };
  dispose(): void;
}

export interface BuildInput {
  record: MoleculeRecord;
  response: ReconstructResponse | null;
  view: LabView;
  mask: number[];
  showHydrogens: boolean;
  palette: ScenePalette;
}

const SPHERE = new THREE.SphereGeometry(1, 48, 32);
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 20);
CYLINDER.translate(0, 0.5, 0);
const UP = new THREE.Vector3(0, 1, 0);

export function atomRadius(el: string) {
  if (el === "H") return 0.2;
  return el === "C" ? 0.34 : 0.36;
}

const physical = (color: string, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.36,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    ...extra,
  });

const textures = new Map<string, THREE.CanvasTexture>();
function glyph(text: string, color: string) {
  const key = `${text}|${color}`;
  let texture = textures.get(key);
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "500 76px 'Geist Variable', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(text, 64, 68);
    }
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, texture);
  }
  return texture;
}

function label(text: string, color: string, at: THREE.Vector3, size: number) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glyph(text, color),
      depthTest: false,
      transparent: true,
      toneMapped: false,
    }),
  );
  sprite.position.copy(at);
  sprite.scale.setScalar(size);
  sprite.renderOrder = 5;
  return sprite;
}

function ring(at: THREE.Vector3, radius: number, color: string, dashed: boolean, opacity: number) {
  const points = Array.from({ length: 73 }, (_, i) => {
    const t = (i / 72) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const shared = { color, transparent: true, opacity, depthTest: false, toneMapped: false };
  const line = new THREE.Line(
    geometry,
    dashed
      ? new THREE.LineDashedMaterial({ ...shared, dashSize: 0.09, gapSize: 0.07 })
      : new THREE.LineBasicMaterial(shared),
  );
  if (dashed) line.computeLineDistances();
  line.position.copy(at);
  line.renderOrder = 4;
  return line;
}

export function buildMolecule({
  record,
  response,
  view,
  mask,
  showHydrogens,
  palette,
}: BuildInput): BuiltMolecule {
  const predicted = view === "reconstructed" || view === "overlay";
  const candidate = predicted ? candidateOf(record, response) : null;
  const structure: { atoms: Atom[]; bonds: Bond[] } = candidate ?? record;
  const centre = centroid(record.atoms);
  const toScene = (v: Vec3) =>
    new THREE.Vector3(v[0] - centre[0], v[1] - centre[1], v[2] - centre[2]);
  const elementColor = (el: string) => palette[el as keyof ScenePalette] ?? palette.C;

  const group = new THREE.Group();
  const atoms: AtomHandle[] = [];
  const halves: HalfHandle[] = [];
  const billboards: THREE.Object3D[] = [];
  const pulses: THREE.Object3D[] = [];
  const maskSet = new Set(mask);
  const sequence = candidate?.tokens ?? record.tokens;
  const wrongToken = (t: number) => sequence[t] !== record.tokens[t];
  const isInfill = (i: number) => {
    const t = structure.atoms[i].tokenIndex;
    return predicted && t !== null && maskSet.has(t);
  };
  const isUnknown = (i: number) => {
    const t = structure.atoms[i].tokenIndex;
    return view === "masked" && t !== null && maskSet.has(t);
  };

  const parent = new Map<number, number>();
  structure.bonds.forEach(({ a, b }) => {
    if (structure.atoms[a].el === "H") parent.set(a, b);
    if (structure.atoms[b].el === "H") parent.set(b, a);
  });
  const hidden = new Set<number>();
  structure.atoms.forEach((a, i) => {
    if (a.el !== "H") return;
    if (!showHydrogens || isUnknown(parent.get(i) ?? -1)) hidden.add(i);
  });

  const maskedBonds = new Set(
    mask.map((t) => record.tokenBond[String(t)]).filter((b) => b !== undefined),
  );
  const colorOf = (i: number) => {
    if (isInfill(i))
      return wrongToken(structure.atoms[i].tokenIndex!) ? palette.warn : palette.brand;
    return elementColor(structure.atoms[i].el);
  };

  for (const s of bondSegments(structure.atoms, structure.bonds)) {
    if (hidden.has(s.owner) || hidden.has(s.other)) continue;
    const from = toScene(s.from);
    const to = toScene(s.to);
    const touchesUnknown =
      isUnknown(s.owner) || isUnknown(s.other) || (view === "masked" && maskedBonds.has(s.bond));
    const repairedBond = predicted && !candidate && maskedBonds.has(s.bond);
    const color = repairedBond
      ? palette.brand
      : s.kind === "inner"
        ? palette.muted
        : colorOf(s.owner);
    const material = physical(color, {
      emissive: new THREE.Color(palette.brand),
      emissiveIntensity: repairedBond ? 0.18 : 0,
      ...(touchesUnknown ? { transparent: true, opacity: 0.16, depthWrite: false } : {}),
    });
    const pivot = new THREE.Group();
    const dir = to.clone().sub(from);
    pivot.position.copy(from);
    pivot.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    const mesh = new THREE.Mesh(CYLINDER, material);
    mesh.scale.set(s.radius, dir.length(), s.radius);
    pivot.add(mesh);
    group.add(pivot);
    halves.push({
      group: pivot,
      material,
      owner: s.owner,
      other: s.other,
      kind: s.kind,
      bond: s.bond,
    });
  }

  structure.atoms.forEach((a, i) => {
    if (hidden.has(i)) return;
    const at = toScene(position(a));
    const radius = atomRadius(a.el);
    const handle = (mesh: AtomHandle["mesh"]) => {
      mesh.position.copy(at);
      mesh.scale.setScalar(radius);
      mesh.userData.atomIndex = i;
      group.add(mesh);
      atoms.push({ mesh, index: i, el: a.el, tokenIndex: a.tokenIndex, radius, position: at });
    };
    if (isUnknown(i)) {
      handle(
        new THREE.Mesh(
          SPHERE,
          new THREE.MeshBasicMaterial({
            color: palette.muted,
            transparent: true,
            opacity: 0.05,
            depthWrite: false,
          }),
        ),
      );
      const dashed = ring(at, radius * 1.2, palette.muted, true, 0.9);
      group.add(dashed);
      billboards.push(dashed);
      group.add(label("?", palette.muted, at, 0.42));
      return;
    }
    const infill = isInfill(i);
    const color = colorOf(i);
    handle(
      new THREE.Mesh(
        SPHERE,
        physical(color, {
          emissive: new THREE.Color(infill ? color : palette.brand),
          emissiveIntensity: infill ? 0.18 : 0,
        }),
      ),
    );
    if (a.el !== "H" && a.el !== "C") group.add(label(a.el, "#ffffff", at, 0.3));
    if (infill && view === "reconstructed") {
      const pulse = ring(at, radius * 1.42, color, false, 0.75);
      group.add(pulse);
      billboards.push(pulse);
      pulses.push(pulse);
    }
  });

  if (view === "overlay") {
    const counterpart = new Map<number, string>();
    (candidate?.atoms ?? []).forEach((a) => {
      if (a.origIndex !== null) counterpart.set(a.origIndex, a.el);
    });
    record.atoms.forEach((a, i) => {
      if (a.el === "H") return;
      const at = toScene(position(a));
      const radius = atomRadius(a.el) * 1.42;
      const mismatch = candidate !== null && counterpart.get(i) !== a.el;
      const ghost = new THREE.Mesh(
        SPHERE,
        new THREE.MeshBasicMaterial({
          color: elementColor(a.el),
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
        }),
      );
      ghost.position.copy(at);
      ghost.scale.setScalar(radius);
      group.add(ghost);
      const shell = ring(
        at,
        radius,
        mismatch ? palette.warn : palette.muted,
        true,
        mismatch ? 1 : 0.5,
      );
      group.add(shell);
      billboards.push(shell);
      if (mismatch)
        group.add(label(a.el, palette.warn, at.clone().add(new THREE.Vector3(0.48, 0.42, 0)), 0.3));
    });
  }

  const radius = Math.max(1.5, ...atoms.map((a) => a.position.length())) + 0.7;
  return {
    group,
    atoms,
    halves,
    billboards,
    pulses,
    radius,
    structure,
    dispose() {
      group.traverse((o) => {
        const material = (o as THREE.Mesh).material as THREE.Material | undefined;
        material?.dispose();
        if (o instanceof THREE.Line) o.geometry.dispose();
      });
    },
  };
}

export function animatePulses(built: BuiltMolecule, time: number) {
  for (const p of built.pulses) {
    p.scale.setScalar(1 + 0.08 * Math.sin(time * 2.4));
    ((p as THREE.Line).material as THREE.LineBasicMaterial).opacity =
      0.42 + 0.34 * Math.cos(time * 2.4);
  }
}
