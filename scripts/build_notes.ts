// Saves Gemini notes for the demo's default runs, so they still show if the network drops.
// node --env-file=.env scripts/build_notes.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildNotePrompt, type NoteRecord, streamNote } from "../api/explain.ts";
import { DEFAULT_MASKS, pickSpan } from "../src/engine/mask.ts";

const OUT = "public/data/notes.json";
const MODELS = ["T5", "ChemBERTa", "BiLSTM", "LSTM"];
const load = (id: string) => JSON.parse(readFileSync(`public/data/molecules/${id}.json`, "utf8")) as NoteRecord;
const numbers = (text: string) => text.match(/\d+(?:\.\d+)?/g) ?? [];

/** Every number in a note must already be in its facts, apart from small counts like "2 sentences". */
function invented(note: string, prompt: string) {
  const known = new Set(numbers(prompt));
  return numbers(note).filter((n) => !known.has(n));
}

const finished = (note: string) => /[.!?]$/.test(note);

async function write(prompt: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const note = (await streamNote(prompt).text).trim();
      const bad = invented(note, prompt);
      if (finished(note) && !bad.length) return note;
      console.warn(`  retrying: ${finished(note) ? `numbers not in facts: ${bad.join(", ")}` : "unfinished"}`);
    } catch (err) {
      console.warn(`  retrying: ${String(err).slice(0, 120)}`);
    }
    if (attempt === 4) throw new Error("No usable note");
    await new Promise((r) => setTimeout(r, 15000));
  }
}

const catalog = JSON.parse(readFileSync("public/data/catalog.json", "utf8")) as { id: string }[];
const jobs: [string, string, number, number][] = [];
for (const { id } of catalog) {
  const span = DEFAULT_MASKS[id] ?? pickSpan(load(id).tokens, 25, 2, 1337);
  for (const model of id in DEFAULT_MASKS ? MODELS : ["T5"]) jobs.push([id, model, span.start, span.length]);
}

const notes: Record<string, string> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
for (const [id, model, start, length] of jobs) {
  const key = `${id}:${model}:${start}:${length}`;
  if (finished(notes[key] ?? "")) continue;
  const record = load(id);
  notes[key] = await write(buildNotePrompt(record, record.runs[`${model}:${start}:${length}`]));
  writeFileSync(OUT, JSON.stringify(notes, null, 1) + "\n");
  console.log(key);
}
console.log(`${jobs.length} notes written to ${OUT}`);
