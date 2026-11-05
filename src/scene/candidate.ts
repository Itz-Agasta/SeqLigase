import type { Candidate, MoleculeRecord, ReconstructResponse } from "@/engine/types";

export function candidateOf(
  record: MoleculeRecord,
  response: ReconstructResponse | null,
): Candidate | null {
  if (!response?.candidate_id || response.candidate_id === "original") return null;
  return record.candidates.find((c) => c.id === response.candidate_id) ?? null;
}
