export type ModelId = "BiLSTM" | "LSTM" | "GRU" | "RNN";
export const MODEL_IDS: ModelId[] = ["BiLSTM", "LSTM", "GRU", "RNN"];

export type TokenKind = "atom" | "ring" | "branch" | "size";

export interface CatalogEntry {
  id: string;
  name: string;
  smiles: string;
  canonical: string;
  formula: string;
  heavyAtoms: number;
  source: "QM9" | "reference";
}

export interface Properties {
  mol_weight: number;
  logp: number;
  hbd: number;
  hba: number;
}

export interface Atom {
  el: string;
  x: number;
  y: number;
  z: number;
  tokenIndex: number | null;
}

export interface CandidateAtom extends Atom {
  origIndex: number | null;
}

export interface Bond {
  a: number;
  b: number;
  order: number;
}

export interface Candidate {
  id: string;
  smiles: string;
  selfies: string;
  tokens: string[];
  formula: string;
  is3d: boolean;
  atoms: CandidateAtom[];
  bonds: Bond[];
  properties: Properties;
}

export interface TokenCandidate {
  token: string;
  p: number;
}

export interface ReconstructResponse {
  original_smiles: string;
  original_selfies: string;
  masked_selfies: string;
  predicted_selfies: string;
  predicted_smiles: string;
  mask_positions: number[];
  topk: Record<string, TokenCandidate[]>;
  valid: boolean;
  token_accuracy: number;
  exact_recovery: boolean;
  tanimoto_similarity: number;
  normalized_edit_distance: number;
  properties: Properties;
  candidate_id: string | null;
  warnings: string[];
}

export interface MoleculeRecord {
  id: string;
  name: string;
  smiles: string;
  source: CatalogEntry["source"];
  selfies: string;
  tokens: string[];
  tokenKinds: TokenKind[];
  atomTokens: number[];
  tokenBond: Record<string, number>;
  formula: string;
  properties: Properties;
  is3d: boolean;
  atoms: Atom[];
  bonds: Bond[];
  candidates: Candidate[];
  runs: Record<string, ReconstructResponse>;
}

export interface CurvePoint {
  epoch: number;
  mean: number;
  lo: number;
  hi: number;
}

export type CompareMetric = "acc" | "top3" | "exact" | "valid";

export interface SplitData {
  curves: Record<ModelId, { acc: CurvePoint[]; loss: CurvePoint[] }>;
  compare: Record<
    CompareMetric,
    { label: string; note: string; values: number[]; ci: number[]; domain: [number, number] }
  >;
  table: { id: string; input: string; model: string; mask: string; values: (number | null)[] }[];
  sweep: Record<ModelId, number[]>;
}

export interface ExperimentsData {
  architectures: { id: ModelId; layers: string; checkpoint: string; params: number }[];
  vocabSize: number;
  splits: { random: SplitData; scaffold: SplitData };
  maskRatios: number[];
  confusion: { tokens: string[]; matrix: number[][] };
  tanimoto: { bins: number[]; valid: number; total: number };
  funnel: { step: string; count: number }[];
}

export interface SpaceData {
  count: number;
  stride: number;
  points: Float32Array;
  formulas: string[];
  catalog: Record<string, number>;
}

export interface ReconstructRequest {
  moleculeId: string;
  model: ModelId;
  start: number;
  length: number;
}

export interface InferenceClient {
  catalog(): Promise<CatalogEntry[]>;
  molecule(id: string): Promise<MoleculeRecord>;
  reconstruct(req: ReconstructRequest): Promise<ReconstructResponse>;
  experiments(): Promise<ExperimentsData>;
  space(): Promise<SpaceData>;
}
