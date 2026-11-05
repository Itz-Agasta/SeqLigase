import { useCallback, useEffect, useRef, useState } from "react";

export function webglSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function watchContextLoss(canvas: HTMLCanvasElement, onLost: () => void) {
  const listener = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", listener);
  return () => canvas.removeEventListener("webglcontextlost", listener);
}

export function useWebGL() {
  const [available, setAvailable] = useState(webglSupported);
  const stop = useRef<(() => void) | null>(null);
  const watch = useCallback((canvas: HTMLCanvasElement) => {
    stop.current?.();
    stop.current = watchContextLoss(canvas, () => setAvailable(false));
  }, []);
  useEffect(() => () => stop.current?.(), []);
  return { available, watch };
}

/** Compare's verdicts don't need 3D, so without WebGL they land immediately. */
export function compareFinishedOnRun(rows: number) {
  return webglSupported() ? 0 : rows;
}
