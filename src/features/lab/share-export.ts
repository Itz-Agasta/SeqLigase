import type { ModelId, ReconstructResponse } from "@/engine/types";
import { type LabSelection, serializeLabSearch } from "@/state/url-state";

export function exportRun(response: ReconstructResponse) {
  return new Blob([JSON.stringify(response, null, 2)], { type: "application/json" });
}

export function exportFilename(moleculeId: string, model: ModelId, start: number, length: number) {
  return `seqligase-${moleculeId}-${model.toLowerCase()}-${start}-${length}.json`;
}

export function shareUrl(selection: LabSelection, origin = window.location.origin) {
  return `${origin}/?${serializeLabSearch(selection)}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
