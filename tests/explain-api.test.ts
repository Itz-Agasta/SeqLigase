import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import handler, {
  type Analysis,
  buildNotePrompt,
  type NoteFacts,
  type NoteRecord,
  parseNoteRequest,
} from "../api/explain.ts";

const props = { mol_weight: 94.11, logp: 1.39, hbd: 1, hba: 1 };
const run = {
  predicted_smiles: "OC1=CC=CN=C1",
  mask_positions: [4, 5],
  topk: { 4: [{ token: "[=C]" }], 5: [{ token: "[N]" }] },
  valid: true,
  exact_recovery: false,
  tanimoto_similarity: 0.4,
  normalized_edit_distance: 0.11,
  properties: { mol_weight: 95.1, logp: 0.78, hbd: 1, hba: 2 },
};
const record: NoteRecord = {
  name: "Phenol",
  formula: "C6H6O",
  smiles: "Oc1ccccc1",
  tokens: ["[O]", "[C]", "[=C]", "[C]", "[=C]", "[C]", "[=C]", "[Ring1]", "[=Branch1]"],
  atoms: [
    { el: "O", tokenIndex: 0 },
    { el: "C", tokenIndex: 4 },
    { el: "C", tokenIndex: 5 },
    { el: "H", tokenIndex: null },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 1, b: 2, order: 2 },
    { a: 2, b: 3, order: 1 },
  ],
  tokenBond: {},
  properties: props,
  runs: { "BiLSTM:4:2": run },
};
const structure = (over: Partial<Analysis>): Analysis => ({
  smiles: "Oc1ccccc1",
  formula: "C6H6O",
  heavyAtoms: 7,
  ringSizes: [6],
  aromaticRings: 1,
  groups: ["phenol"],
  flags: [],
  inQm9: true,
  ...over,
});
const facts: NoteFacts = {
  original: structure({}),
  runs: {
    "BiLSTM:4:2": {
      predicted: structure({
        smiles: "OC1=CC=CN=C1",
        formula: "C5H5NO",
        groups: ["phenol", "aromatic nitrogen"],
        inQm9: false,
        flags: ["N-O bond"],
      }),
      alternative: {
        position: 5,
        token: "[C]",
        p: 0.097,
        topToken: "[N]",
        topP: 0.62,
        result: structure({ aromaticRings: 0 }),
      },
    },
  },
};
const prompt = (r = run) => buildNotePrompt(record, r, facts, "BiLSTM:4:2");
const url = (q: string) => `https://x.test/api/explain?${q}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("note request", () => {
  it("accepts a known selection", () => {
    expect(parseNoteRequest(url("mol=phenol&model=T5&start=4&len=2"))).toEqual({
      moleculeId: "phenol",
      model: "T5",
      start: 4,
      length: 2,
    });
  });

  it.each([
    "mol=../secret&model=T5&start=4&len=2",
    "mol=phenol&model=GPT&start=4&len=2",
    "mol=phenol&model=T5&start=-1&len=2",
    "mol=phenol&model=T5&start=4&len=0",
    "mol=phenol&model=T5",
  ])("rejects %s", (q) => {
    expect(parseNoteRequest(url(q))).toBeNull();
  });
});

describe("note prompt", () => {
  it("states the structural changes a chemist would check", () => {
    const text = prompt();
    expect(text).toContain("Groups gained: aromatic nitrogen. Groups lost: none.");
    expect(text).toContain("flags: N-O bond");
    expect(text).toContain("known in QM9: no");
    expect(text).toContain("LogP 0.78");
    expect(text).toContain("[=C] is a C atom bonded to O (single), C (double)");
  });

  it("describes what the runner-up would have made", () => {
    const text = prompt();
    expect(text).toContain("Least certain position 5: [N] at 62.0%, runner-up [C] at 9.7%.");
    expect(text).toContain("Runner-up versus original: same molecule as the original");
  });

  it("lists only what the runner-up changes", () => {
    const changed = structuredClone(facts);
    changed.runs["BiLSTM:4:2"].alternative.result = structure({
      smiles: "C1=CC=CC=C1",
      formula: "C6H6",
      groups: [],
      aromaticRings: 1,
      flags: ["N-N bond"],
      inQm9: false,
    });
    const text = buildNotePrompt(record, run, changed, "BiLSTM:4:2");
    expect(text).toContain("groups lost: phenol");
    expect(text).toContain("new flags: N-N bond");
    expect(text).not.toContain("aromatic rings: 1 to");
  });

  it("leaves the predicted section out of an exact recovery", () => {
    const text = prompt({ ...run, exact_recovery: true });
    expect(text).toContain("Exact recovery: yes");
    expect(text).not.toContain("Groups gained");
    expect(text).toContain("runner-up");
  });

  it("says when a prediction didn't decode", () => {
    const broken = { ...facts.runs["BiLSTM:4:2"], predicted: null };
    const text = buildNotePrompt(
      record,
      { ...run, valid: false },
      { ...facts, runs: { "BiLSTM:4:2": broken } },
      "BiLSTM:4:2",
    );
    expect(text).toContain("did not decode");
    expect(text).not.toContain("Predicted properties");
  });
});

describe("handler", () => {
  it("rejects a bad request before doing anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await handler.fetch(new Request(url("mol=phenol&model=GPT&start=1&len=1")));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports when no key is set", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const res = await handler.fetch(new Request(url("mol=phenol&model=T5&start=4&len=2")));
    expect(res.status).toBe(503);
  });

  it("returns 404 for a run that doesn't exist", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test");
    const res = await handler.fetch(new Request(url("mol=phenol&model=T5&start=40&len=3")));
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown molecule", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test");
    const res = await handler.fetch(new Request(url("mol=nope&model=T5&start=0&len=1")));
    expect(res.status).toBe(404);
  });
});
