import { readFile } from "node:fs/promises";
import path from "node:path";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";

const MODELS = ["T5", "ChemBERTa", "BiLSTM", "LSTM"];
const GEMINI_MODEL = "gemini-3.8-flash";

const SYSTEM = `You write a short note under a molecular reconstruction result, for practising chemists.
Write 1 or 2 plain sentences, at most 45 words in total.
The reader can already see the similarity, edit distance, validity, property table and token probabilities. Tell them what those don't: the structural consequence, and what is worth checking.
If the prediction differs from the original, lead with the most important of: aromaticity or ring changes, functional groups gained or lost, then any structural flag. Say whether the predicted molecule is known in QM9. If it isn't, call it unconfirmed.
If it is an exact recovery, give the least certain position with both percentages, then what changes if its runner-up is used. Only report what the "Runner-up versus original" fact lists.
Rules:
- Use only the facts provided. Name a group, ring or flag only if it is listed. Quote numbers exactly.
- A flag is a reason to check a structure, not proof that it is unstable.
- Not being in QM9 doesn't mean a molecule can't exist. QM9 only covers up to nine heavy atoms.
- Only name the original molecule. Describe every other structure by its groups and rings, never by a compound name.
- Only say the runner-up restores the original if the facts say so.
- Mention aromaticity only if it changes. Never write about zero aromatic rings.
- Don't grade with words like moderately, weakly or strongly. Let the percentages speak.
- Never say why the model made its choice. You don't know that.
- Never mention synthesis, hazards, uses, applications or sources.
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
export interface Analysis {
  smiles: string;
  formula: string;
  heavyAtoms: number;
  ringSizes: number[];
  aromaticRings: number;
  groups: string[];
  flags: string[];
  inQm9: boolean;
}
export interface NoteFacts {
  original: Analysis;
  runs: Record<
    string,
    {
      predicted: Analysis | null;
      alternative: {
        position: number;
        token: string;
        p: number;
        topToken: string;
        topP: number;
        result: Analysis | null;
      };
    }
  >;
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

const percent = (p: number) => `${(p * 100).toFixed(1)}%`;
const list = (items: string[]) => (items.length ? items.join(", ") : "none");

const ringNames = (a: Analysis) =>
  a.ringSizes.length ? a.ringSizes.map((n) => `${n}-membered`).join(", ") : "no rings";

function describeChange(from: Analysis, to: Analysis): string {
  if (to.smiles === from.smiles) return "same molecule as the original";
  const gained = to.groups.filter((g) => !from.groups.includes(g));
  const lost = from.groups.filter((g) => !to.groups.includes(g));
  const flags = to.flags.filter((f) => !from.flags.includes(f));
  const changes = [
    `different molecule, ${to.formula}`,
    `groups gained: ${list(gained)}`,
    `groups lost: ${list(lost)}`,
    `new flags: ${list(flags)}`,
    `known in QM9: ${to.inQm9 ? "yes" : "no"}`,
  ];
  if (to.aromaticRings !== from.aromaticRings)
    changes.push(`aromatic rings: ${from.aromaticRings} to ${to.aromaticRings}`);
  if (to.ringSizes.join() !== from.ringSizes.join())
    changes.push(`rings: ${ringNames(from)} to ${ringNames(to)}`);
  return changes.join("; ");
}

function describeStructure(a: Analysis): string {
  return [
    `SMILES ${a.smiles}, ${a.formula}`,
    `rings: ${ringNames(a)}`,
    `aromatic rings: ${a.aromaticRings}`,
    `groups: ${list(a.groups)}`,
    `flags: ${list(a.flags)}`,
    `known in QM9: ${a.inQm9 ? "yes" : "no"}`,
  ].join("; ");
}

/** Facts come only from the precomputed RDKit results, never from the caller. */
export function buildNotePrompt(
  record: NoteRecord,
  run: Run,
  facts: NoteFacts,
  key: string,
): string {
  const { predicted, alternative: alt } = facts.runs[key];
  const original = facts.original;
  const lines = [
    `Original: ${record.name}. ${describeStructure(original)}`,
    `Original properties: ${describe(record.properties)}`,
    `Masked tokens map to: ${run.mask_positions.map((pos) => describeToken(record, pos)).join("; ")}`,
    `Exact recovery: ${run.exact_recovery ? "yes" : "no"}`,
  ];
  if (predicted && !run.exact_recovery) {
    const gained = predicted.groups.filter((g) => !original.groups.includes(g));
    const lost = original.groups.filter((g) => !predicted.groups.includes(g));
    lines.push(
      `Predicted: ${describeStructure(predicted)}`,
      `Predicted properties: ${describe(run.properties)}`,
      `Groups gained: ${list(gained)}. Groups lost: ${list(lost)}.`,
      `Aromatic rings: ${original.aromaticRings} to ${predicted.aromaticRings}. Heavy atoms: ${original.heavyAtoms} to ${predicted.heavyAtoms}.`,
    );
  }
  if (!predicted) lines.push("The predicted sequence did not decode to a valid molecule.");
  lines.push(
    `Least certain position ${alt.position}: ${alt.topToken} at ${percent(alt.topP)}, runner-up ${alt.token} at ${percent(alt.p)}.`,
    alt.result
      ? `Runner-up versus original: ${describeChange(original, alt.result)}`
      : "The runner-up would not decode to a valid molecule.",
  );
  return lines.join("\n");
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

    const file = path.join(process.cwd(), "public/data/molecules", `${req.moleculeId}.json`);
    const data = await readFile(file, "utf8").catch(() => null);
    if (!data) return new Response("Unknown molecule", { status: 404 });
    const record = JSON.parse(data) as NoteRecord;
    const key = `${req.model}:${req.start}:${req.length}`;
    const run = record.runs[key];
    if (!run) return new Response("Unknown run", { status: 404 });
    const factsFile = path.join(process.cwd(), "public/data/note-facts", `${req.moleculeId}.json`);
    const facts = JSON.parse(await readFile(factsFile, "utf8")) as NoteFacts;

    return streamNote(buildNotePrompt(record, run, facts, key)).toTextStreamResponse();
  },
};
