export type QualityTier = "high" | "low";

export const PARTICLES: Record<QualityTier, number> = { high: 2400, low: 800 };

const WINDOW = 90;
const LOW_FPS = 30;
const MAX_FRAME = 1;

export function qualityFromSearch(search: string): QualityTier {
  return new URLSearchParams(search).get("quality") === "low" ? "low" : "high";
}

/** Calls onDowngrade once if the average frame rate stays low across a full window. */
export function createFpsMonitor(onDowngrade: () => void) {
  let frames = 0;
  let total = 0;
  let done = false;
  return {
    frame(dt: number) {
      if (done || dt > MAX_FRAME) return;
      frames += 1;
      total += dt;
      if (frames < WINDOW) return;
      if (frames / total < LOW_FPS) {
        done = true;
        onDowngrade();
      }
      frames = 0;
      total = 0;
    },
  };
}
