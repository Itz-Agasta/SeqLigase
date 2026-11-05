import type { ModelId } from "@/engine/types";

export interface RunEntry {
  id: string;
  at: number;
  moleculeId: string;
  name: string;
  model: ModelId;
  start: number;
  length: number;
  seed: number;
  exact: boolean;
  valid: boolean;
  tanimoto: number;
}

export const MAX_RUNS = 200;
const KEY = "seqligase-runs";

function read(): RunEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as RunEntry[]) : [];
  } catch {
    return [];
  }
}

export const runLog = {
  list: read,
  add(entry: RunEntry) {
    try {
      localStorage.setItem(KEY, JSON.stringify([entry, ...read()].slice(0, MAX_RUNS)));
    } catch {
      // Storage can be blocked. History is optional.
    }
  },
  replace(entries: RunEntry[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {
      // Storage can be blocked. History is optional.
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Storage can be blocked. There is nothing to clear in that case.
    }
  },
};
