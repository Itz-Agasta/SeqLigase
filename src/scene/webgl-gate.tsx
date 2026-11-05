import type { ReactNode } from "react";
import { useWebGL } from "./use-webgl";

export function WebGLGate({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const { available } = useWebGL();
  return available ? children : fallback;
}
