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

/** The moment plays on dark space in both themes. */
export const MOMENT_PALETTE: Partial<ScenePalette> = {
  C: "#9aa1ab",
  H: "#e6e8ec",
  brand: "#6f7cf0",
  warn: "#e0a84e",
  muted: "#a1a3a9",
};
