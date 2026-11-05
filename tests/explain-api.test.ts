import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import handler, { buildNotePrompt, type NoteRecord, parseNoteRequest } from "./explain.ts";

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
  it("states the computed values and the tokens that changed", () => {
    const prompt = buildNotePrompt(record, run);
    expect(prompt).toContain("Masked SELFIES tokens: [=C] [C]");
    expect(prompt).toContain("Predicted SELFIES tokens: [=C] [N]");
    expect(prompt).toContain("OC1=CC=CN=C1");
    expect(prompt).toContain("0.400");
    expect(prompt).toContain("LogP 0.78");
    expect(prompt).toContain("[=C] is a C atom bonded to O (single), C (double)");
  });

  it("leaves out predicted values for an invalid structure", () => {
    const prompt = buildNotePrompt(record, { ...run, valid: false });
    expect(prompt).toContain("RDKit valid: no");
    expect(prompt).not.toContain("Predicted properties");
    expect(prompt).not.toContain("Tanimoto");
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(record)),
    );
    const res = await handler.fetch(new Request(url("mol=phenol&model=T5&start=0&len=3")));
    expect(res.status).toBe(404);
  });
});
