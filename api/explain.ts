import { google } from "@ai-sdk/google";
import { streamText } from "ai";

const MODELS = ["T5", "ChemBERTa", "BiLSTM", "LSTM"];
const GEMINI_MODEL = "gemini-3.8-flash";

const SYSTEM = `You write a short note shown under a molecular reconstruction result, for chemists.
Write 1 or 2 plain sentences, at most 45 words in total.
The reader can already see the similarity, edit distance and validity, so never repeat those. Say what they can't see: what changed chemically, and what that does to the properties.
Rules:
- Use only the facts provided, and quote their numbers exactly.
- Describe structures by atoms, rings and functional groups you can read directly from the SMILES. Only name a predicted compound if you are certain of the name.
- Never explain why the model made its choice. You don't know that.
- Never mention synthesis, hazards, uses, applications or sources.
- If the prediction is an exact recovery, write one sentence saying which part of the molecule the masked tokens rebuilt. Base it only on the "Masked tokens map to" fact, and don't infer which atom a token is. Quote no numbers.
- No markdown, headings or preamble.`;

interface Props {
  mol_weight: number;
  logp: number;
  hbd: number;
  hba: number;
}
interface Run {
  predicted_smiles: string;
  mask_positions: number[];
  topk: Record<string, { token: string }[]>;
  valid: boolean;
  exact_recovery: boolean;
  tanimoto_similarity: number;
  normalized_edit_distance: number;
  properties: Props;
}
export interface NoteRecord {
  name: string;
  formula: string;
  smiles: string;
  tokens: string[];
  atoms: { el: string; tokenIndex: number | null }[];
  bonds: { a: number; b: number; order: number }[];
  tokenBond: Record<string, number>;
  properties: Props;
  runs: Record<string, Run>;
}
export interface NoteRequest {
  moleculeId: string;
  model: string;
  start: number;
  length: number;
}

export function parseNoteRequest(url: string): NoteRequest | null {
  const params = new URL(url).searchParams;
  const moleculeId = params.get("mol") ?? "";
  const model = params.get("model") ?? "";
  const start = Number(params.get("start"));
  const length = Number(params.get("len"));
  if (!/^[a-z0-9-]{1,40}$/.test(moleculeId) || !MODELS.includes(model)) return null;
  if (!Number.isInteger(start) || start < 0 || !Number.isInteger(length) || length < 1) return null;
  return { moleculeId, model, start, length };
}

const describe = (p: Props) =>
  `mol. weight ${p.mol_weight}, LogP ${p.logp}, H-bond donors ${p.hbd}, H-bond acceptors ${p.hba}`;

const BOND_NAMES: Record<number, string> = {
  1: "single",
  1.5: "aromatic",
  2: "double",
  3: "triple",
};

/** Says what each masked token is in the real structure, so the note never has to guess. */
function describeToken(record: NoteRecord, pos: number): string {
  const token = record.tokens[pos];
  const atom = record.atoms.findIndex((a) => a.tokenIndex === pos);
  if (atom >= 0) {
    const neighbours = record.bonds.flatMap((b) => {
      const other = b.a === atom ? b.b : b.b === atom ? b.a : -1;
      return other < 0 ? [] : [`${record.atoms[other].el} (${BOND_NAMES[b.order] ?? b.order})`];
    });
    return `${token} is a ${record.atoms[atom].el} atom bonded to ${neighbours.join(", ")}`;
  }
  const bond = record.bonds[record.tokenBond[pos]];
  if (bond) {
    const [a, b] = [record.atoms[bond.a].el, record.atoms[bond.b].el];
    return `${token} closes a ${BOND_NAMES[bond.order] ?? bond.order} ring bond between ${a} and ${b}`;
  }
  return `${token} is a structural token that places no atom`;
}

/** Facts come only from the precomputed RDKit results, never from the caller. */
export function buildNotePrompt(record: NoteRecord, run: Run): string {
  const predicted = run.mask_positions.map((pos) => run.topk[pos]?.[0]?.token ?? "?");
  const original = run.mask_positions.map((pos) => record.tokens[pos]);
  return [
    `Original: ${record.name}, ${record.formula}, SMILES ${record.smiles}`,
    `Original properties: ${describe(record.properties)}`,
    `Masked SELFIES tokens: ${original.join(" ")}`,
    `Masked tokens map to: ${run.mask_positions.map((pos) => describeToken(record, pos)).join("; ")}`,
    `Predicted SELFIES tokens: ${predicted.join(" ")}`,
    `Exact recovery: ${run.exact_recovery ? "yes" : "no"}`,
    `RDKit valid: ${run.valid ? "yes" : "no"}`,
    ...(run.valid
      ? [
          `Predicted SMILES: ${run.predicted_smiles}`,
          `Predicted properties: ${describe(run.properties)}`,
          `Morgan Tanimoto similarity to the original: ${run.tanimoto_similarity.toFixed(3)}`,
        ]
      : []),
    `Normalised edit distance: ${run.normalized_edit_distance.toFixed(2)}`,
  ].join("\n");
}

export function streamNote(prompt: string) {
  return streamText({
    model: google(GEMINI_MODEL),
    system: SYSTEM,
    prompt,
    maxOutputTokens: 1000,
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
  });
}

export default {
  async fetch(request: Request) {
    const req = parseNoteRequest(request.url);
    if (!req) return new Response("Invalid request", { status: 400 });
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      return new Response("Notes aren't configured", { status: 503 });

    const data = await fetch(new URL(`/data/molecules/${req.moleculeId}.json`, request.url));
    if (!data.ok) return new Response("Unknown molecule", { status: 404 });
    const record = (await data.json()) as NoteRecord;
    const run = record.runs[`${req.model}:${req.start}:${req.length}`];
    if (!run) return new Response("Unknown run", { status: 404 });

    return streamNote(buildNotePrompt(record, run)).toTextStreamResponse();
  },
};
