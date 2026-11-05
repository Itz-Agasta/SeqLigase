export interface ScenePalette {
  C: string;
  H: string;
  O: string;
  N: string;
  F: string;
  brand: string;
  warn: string;
  muted: string;
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function readPalette(): ScenePalette {
  return {
    C: cssVar("--seq-atom-c"),
    H: cssVar("--seq-atom-h"),
    O: "#e8604c",
    N: "#5b8def",
    F: "#4fbf8b",
    brand: cssVar("--seq-brand"),
    warn: cssVar("--seq-warn"),
    muted: cssVar("--muted-foreground"),
  };
}
