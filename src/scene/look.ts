/** How the molecule is drawn at a given camera distance. All values run from 0 to 1. */
export interface Look {
  solid: number;
  shell: number;
  labels: number;
  lengths: number;
}

const SHELL_OPACITY = 0.18;

export const DEFAULT_LOOK: Look = { solid: 0, shell: SHELL_OPACITY, labels: 0, lengths: 0 };
export const HIDDEN_LOOK: Look = { solid: 0, shell: 0, labels: 0, lengths: 0 };

/** Camera distance limits, as a multiple of the distance that frames the molecule. */
export const ZOOM_LIMITS = { min: 0.3, max: 1.6 };
const ZOOM_STEP = 1.25;

function smooth(from: number, to: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export function zoomLook(ratio: number): Look {
  return {
    solid: smooth(1.12, 1.38, ratio),
    shell: SHELL_OPACITY * smooth(0.62, 0.82, ratio),
    labels: 1 - smooth(0.6, 0.8, ratio),
    lengths: 1 - smooth(0.36, 0.5, ratio),
  };
}

export function stepZoom(ratio: number, direction: -1 | 1) {
  const next = direction < 0 ? ratio / ZOOM_STEP : ratio * ZOOM_STEP;
  return Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, next));
}

/** Bondi van der Waals radii, in angstroms. */
const VDW: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, F: 1.47 };

export const vdwRadius = (element: string) => VDW[element] ?? 1.7;

export function bondLength(a: [number, number, number], b: [number, number, number]) {
  return `${Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(2)} Å`;
}
