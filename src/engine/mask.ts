export type MaskRatio = 15 | 25 | 35;
export type MaxSpan = 1 | 2 | 3;

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Masks that show a molecule's most useful result when it's first chosen. */
export const DEFAULT_MASKS: Record<string, { start: number; length: number }> = {
  phenol: { start: 4, length: 2 },
  aniline: { start: 0, length: 2 },
};

export function pickSpan(tokens: string[], ratio: MaskRatio, maxSpan: MaxSpan, seed: number) {
  const n = tokens.length;
  const length = Math.min(Math.max(1, Math.round((n * ratio) / 100)), maxSpan, n);
  const start = Math.floor(mulberry32(seed * 31 + ratio + maxSpan)() * (n - length + 1));
  return { start, length };
}
