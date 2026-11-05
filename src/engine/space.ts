import type { SpaceData } from "./types";

export function decodeSpace(meta: Omit<SpaceData, "points">, buffer: ArrayBuffer): SpaceData {
  const points = new Float32Array(buffer);
  if (points.length !== meta.count * meta.stride)
    throw new Error("Chemical space file has the wrong size");
  return { ...meta, points };
}
