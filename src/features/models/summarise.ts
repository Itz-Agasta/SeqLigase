import {
  MODEL_IDS,
  type ModelId,
  type MoleculeRecord,
  type ReconstructResponse,
} from "@/engine/types";
import { verdictOf } from "@/features/lab/format";

export interface CompareRow {
  model: ModelId;
  response: ReconstructResponse;
  verdict: ReturnType<typeof verdictOf>;
  tanimoto: number;
  correct: number;
  total: number;
  tokens: { position: number; token: string; right: boolean }[];
}

export function summariseCompare(
  record: MoleculeRecord,
  start: number,
  length: number,
): CompareRow[] {
  return MODEL_IDS.flatMap((model) => {
    const response = record.runs[`${model}:${start}:${length}`];
    if (!response) return [];
    const tokens = response.mask_positions.map((position) => {
      const token = response.topk[String(position)][0].token;
      return { position, token, right: token === record.tokens[position] };
    });
    return [
      {
        model,
        response,
        verdict: verdictOf(response),
        tanimoto: response.tanimoto_similarity,
        correct: tokens.filter((t) => t.right).length,
        total: tokens.length,
        tokens,
      },
    ];
  });
}
