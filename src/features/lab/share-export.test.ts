import { describe, expect, it } from "vite-plus/test";
import type { ReconstructResponse } from "@/engine/types";
import { parseLabSearch } from "@/state/url-state";
import { exportFilename, exportRun, shareUrl } from "./share-export";

const response = {
  original_smiles: "O",
  original_selfies: "[O]",
  masked_selfies: "[MASK]",
  predicted_selfies: "[O]",
  predicted_smiles: "O",
  mask_positions: [0],
  topk: {},
  valid: true,
  token_accuracy: 1,
  exact_recovery: true,
  tanimoto_similarity: 1,
  normalized_edit_distance: 0,
  properties: { mol_weight: 18, logp: 0, hbd: 1, hba: 1 },
  candidate_id: "original",
  warnings: [],
} as ReconstructResponse;

describe("share and export", () => {
  it("exports the guide's response fields as JSON", async () => {
    const blob = exportRun(response);
    expect(blob.type).toBe("application/json");
    const parsed = JSON.parse(await blob.text()) as ReconstructResponse;
    expect(parsed.predicted_selfies).toBe("[O]");
    expect(parsed.tanimoto_similarity).toBe(1);
  });
  it("names the file after the run", () => {
    expect(exportFilename("phenol", "BiLSTM", 4, 2)).toBe("seqligase-phenol-bilstm-4-2.json");
  });
  it("makes a URL that round-trips", () => {
    const selection = {
      moleculeId: "aniline",
      model: "ChemBERT",
      start: 2,
      length: 3,
      seed: 8,
    } as const;
    const url = new URL(shareUrl(selection, "https://example.com"));
    expect(parseLabSearch(url.searchParams, new Set(["aniline"]))).toEqual(selection);
    expect(url.pathname).toBe("/");
  });
});
