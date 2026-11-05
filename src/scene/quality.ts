export type QualityTier = "high" | "low";

export const PARTICLES: Record<QualityTier, number> = { high: 2400, low: 800 };

const WINDOW_SECONDS = 1;
const LOW_WINDOWS = 2;
const LOW_FPS = 30;
const MAX_FRAME = 1;

export function qualityFromSearch(search: string): QualityTier {
  return new URLSearchParams(search).get("quality") === "low" ? "low" : "high";
}

/** Calls onDowngrade once if the frame rate stays low for two windows in a row. */
export function createFpsMonitor(onDowngrade: () => void) {
  let frames = 0;
  let total = 0;
  let lowWindows = 0;
  let done = false;
  return {
    frame(dt: number) {
      if (done || dt > MAX_FRAME) return;
      frames += 1;
      total += dt;
      if (total < WINDOW_SECONDS) return;
      lowWindows = frames / total < LOW_FPS ? lowWindows + 1 : 0;
      frames = 0;
      total = 0;
      if (lowWindows >= LOW_WINDOWS) {
        done = true;
        onDowngrade();
      }
    },
  };
}
