import type { CurvePoint, ModelId } from "@/engine/types";

export const MODEL_COLORS: Record<ModelId, string> = {
  BiLSTM: "var(--chart-1)",
  LSTM: "var(--chart-2)",
  ChemBERT: "var(--chart-3)",
  T5: "var(--chart-4)",
};

export const modelColor = (model: ModelId) => MODEL_COLORS[model];

const MIN_ZOOM_EPOCHS = 3;

export function resolveBrush(
  a: number,
  b: number,
  domain: [number, number],
): [number, number] | null {
  const lo = Math.max(domain[0], Math.round(Math.min(a, b)));
  const hi = Math.min(domain[1], Math.round(Math.max(a, b)));
  return hi - lo < MIN_ZOOM_EPOCHS ? null : [lo, hi];
}

export function curveDomain(series: CurvePoint[][], range: [number, number]): [number, number] {
  const points = series.flat().filter((p) => p.epoch >= range[0] && p.epoch <= range[1]);
  if (points.length === 0) return [0, 1];
  return [Math.min(...points.map((p) => p.lo)), Math.max(...points.map((p) => p.hi))];
}
