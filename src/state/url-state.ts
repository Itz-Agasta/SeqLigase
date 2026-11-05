import { MODEL_IDS, type ModelId } from "@/engine/types";

export interface LabSelection {
  moleculeId: string;
  model: ModelId;
  start: number | null;
  length: number;
  seed: number;
}

export const DEFAULT_SELECTION = {
  moleculeId: "phenol",
  model: "T5",
  start: 4,
  length: 2,
  seed: 1337,
} as const satisfies LabSelection;

function intParam(
  params: URLSearchParams,
  key: string,
  valid: (n: number) => boolean,
): number | null {
  const raw = params.get(key);
  if (raw === null || !/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  return valid(n) ? n : null;
}

export function parseLabSearch(params: URLSearchParams, known: ReadonlySet<string>): LabSelection {
  const requested = params.get("mol");
  const moleculeId = requested && known.has(requested) ? requested : DEFAULT_SELECTION.moleculeId;
  const isDefault = moleculeId === DEFAULT_SELECTION.moleculeId;
  const model = MODEL_IDS.find((m) => m.toLowerCase() === params.get("model")?.toLowerCase());
  const start = intParam(params, "start", (n) => n >= 0);
  const length = intParam(params, "len", (n) => n >= 1 && n <= 3);
  const usable = requested === moleculeId || !requested;
  return {
    moleculeId,
    model: model ?? DEFAULT_SELECTION.model,
    start:
      usable && start !== null && length !== null
        ? start
        : isDefault
          ? DEFAULT_SELECTION.start
          : null,
    length: usable && start !== null && length !== null ? length : DEFAULT_SELECTION.length,
    seed: intParam(params, "seed", (n) => n >= 0) ?? DEFAULT_SELECTION.seed,
  };
}

export function clampSelection<T extends { start: number | null; length: number }>(
  selection: T,
  tokenCount: number,
) {
  const length = Math.min(selection.length, tokenCount);
  const start = Math.max(0, Math.min(selection.start ?? 0, tokenCount - length));
  return { ...selection, start, length };
}

export function serializeLabSearch(s: LabSelection): string {
  const params = new URLSearchParams({ mol: s.moleculeId, model: s.model.toLowerCase() });
  if (s.start !== null) {
    params.set("start", String(s.start));
    params.set("len", String(s.length));
  }
  params.set("seed", String(s.seed));
  return params.toString();
}

/** The address bar form of a selection. It keeps a forced quality setting across URL updates. */
export function syncSearch(s: LabSelection, currentSearch: string): string {
  const quality = new URLSearchParams(currentSearch).get("quality");
  const search = serializeLabSearch(s);
  return quality ? `${search}&quality=${encodeURIComponent(quality)}` : search;
}
