import type { Atom, Bond } from "@/engine/types";

export type Vec3 = [number, number, number];

export interface Segment {
  bond: number;
  owner: number;
  other: number;
  kind: "main" | "inner";
  from: Vec3;
  to: Vec3;
  radius: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3) => Math.hypot(...a);
const normal = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-6 ? scale(a, 1 / l) : [0, 0, 0];
};
const lerp = (a: Vec3, b: Vec3, t: number) => add(a, scale(sub(b, a), t));
const clean = (v: Vec3): Vec3 => v.map((n) => Math.round(n * 1e5) / 1e5) as Vec3;

export const position = (a: Atom): Vec3 => [a.x, a.y, a.z];

export function centroid(atoms: Atom[]): Vec3 {
  const sum = atoms.reduce<Vec3>((acc, a) => add(acc, position(a)), [0, 0, 0]);
  return scale(sum, 1 / Math.max(atoms.length, 1));
}

/** A unit vector perpendicular to the bond, lying in the plane of its neighbours. */
function inPlaneOffset(
  atoms: Atom[],
  neighbours: Map<number, number[]>,
  a: number,
  b: number,
): Vec3 {
  const A = position(atoms[a]);
  const dir = normal(sub(position(atoms[b]), A));
  const other = neighbours.get(a)?.find((n) => n !== b) ?? neighbours.get(b)?.find((n) => n !== a);
  const reference: Vec3 =
    other === undefined
      ? Math.abs(dir[2]) < 0.9
        ? [0, 0, 1]
        : [0, 1, 0]
      : sub(position(atoms[other]), A);
  const plane = normal(cross(dir, reference));
  if (other === undefined) return plane;
  const offset = normal(cross(plane, dir));
  return length(offset) > 0 ? offset : normal(cross(dir, [0, 0, 1]));
}

export function bondSegments(atoms: Atom[], bonds: Bond[]): Segment[] {
  const neighbours = new Map<number, number[]>();
  bonds.forEach(({ a, b }) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  });
  const aromatic = [...new Set(bonds.filter((b) => b.order === 1.5).flatMap((b) => [b.a, b.b]))];
  const out: Segment[] = [];

  bonds.forEach(({ a, b, order }, bond) => {
    const A = position(atoms[a]);
    const B = position(atoms[b]);
    const M = lerp(A, B, 0.5);
    const hydrogen = atoms[a].el === "H" || atoms[b].el === "H";
    const pair = (shift: Vec3, radius: number, kind: Segment["kind"] = "main") => {
      out.push({
        bond,
        owner: a,
        other: b,
        kind,
        from: clean(add(A, shift)),
        to: clean(add(M, shift)),
        radius,
      });
      out.push({
        bond,
        owner: b,
        other: a,
        kind,
        from: clean(add(B, shift)),
        to: clean(add(M, shift)),
        radius,
      });
    };
    if (order === 2 || order === 3) {
      const off = inPlaneOffset(atoms, neighbours, a, b);
      const spread = order === 2 ? 0.1 : 0.135;
      pair(scale(off, spread), 0.058);
      pair(scale(off, -spread), 0.058);
      if (order === 3) pair([0, 0, 0], 0.05);
    } else if (order === 1.5) {
      pair([0, 0, 0], 0.078);
      // A shared ring system can hold more than one ring, so point to the nearest aromatic neighbours.
      const local = aromatic.filter((i) => length(sub(position(atoms[i]), M)) < 3.2);
      const centre = local.reduce<Vec3>((acc, i) => add(acc, position(atoms[i])), [0, 0, 0]);
      const inward = scale(normal(sub(scale(centre, 1 / local.length), M)), 0.2);
      const u = add(lerp(A, B, 0.18), inward);
      const w = add(lerp(B, A, 0.18), inward);
      const mid = lerp(u, w, 0.5);
      out.push({
        bond,
        owner: a,
        other: b,
        kind: "inner",
        from: clean(u),
        to: clean(mid),
        radius: 0.03,
      });
      out.push({
        bond,
        owner: b,
        other: a,
        kind: "inner",
        from: clean(w),
        to: clean(mid),
        radius: 0.03,
      });
    } else {
      pair([0, 0, 0], hydrogen ? 0.045 : 0.078);
    }
  });
  return out;
}
