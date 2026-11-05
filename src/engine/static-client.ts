import { decodeSpace } from "./space";
import type {
  CatalogEntry,
  ExperimentsData,
  InferenceClient,
  MoleculeRecord,
  SpaceData,
} from "./types";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

function cached<T>(load: () => Promise<T>) {
  let promise: Promise<T> | undefined;
  return () => {
    promise ??= load().catch((err: unknown) => {
      promise = undefined;
      throw err;
    });
    return promise;
  };
}

const FIRST_CHUNK_MS = 8000;

/** The note can't be written for this run, so trying again won't help. */
export class NoteUnavailableError extends Error {}

export function createStaticClient(base = "/data", api = "/api"): InferenceClient {
  const notes = cached(() => fetchJson<Record<string, string>>(`${base}/notes.json`));
  const written = new Map<string, string>();
  const molecules = new Map<string, () => Promise<MoleculeRecord>>();
  const molecule = (id: string) => {
    if (!molecules.has(id))
      molecules.set(
        id,
        cached(() => fetchJson<MoleculeRecord>(`${base}/molecules/${id}.json`)),
      );
    return molecules.get(id)!();
  };
  return {
    catalog: cached(() => fetchJson<CatalogEntry[]>(`${base}/catalog.json`)),
    experiments: cached(() => fetchJson<ExperimentsData>(`${base}/experiments.json`)),
    molecule,
    notes,
    async *explain({ moleculeId, model, start, length }) {
      const key = `${moleculeId}:${model}:${start}:${length}`;
      const known = written.get(key);
      if (known) {
        yield known;
        return;
      }
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), FIRST_CHUNK_MS);
      const query = new URLSearchParams({
        mol: moleculeId,
        model,
        start: String(start),
        len: String(length),
      });
      let text = "";
      let unavailable = false;
      try {
        const res = await fetch(`${api}/explain?${query}`, { signal: abort.signal });
        // A static host answers unknown paths with the app's HTML, so check this really is a note.
        const isText = res.headers.get("content-type")?.startsWith("text/plain");
        // Missing, unconfigured or static hosts answer the same way every time. Other errors may pass.
        unavailable = [400, 404, 503].includes(res.status) || (res.ok && !isText);
        if (!res.ok || !res.body || !isText) throw new Error(`Note failed (${res.status})`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          clearTimeout(timer);
          text += chunk;
          yield chunk;
        }
      } catch (err) {
        // Once text is on screen a drop is a real failure. Before that, the saved note stands in.
        if (text) throw err;
      } finally {
        clearTimeout(timer);
        abort.abort();
      }
      if (!text) {
        text = (await notes())[key] ?? "";
        if (!text) {
          if (unavailable) throw new NoteUnavailableError(`No note for ${key}`);
          throw new Error(`No note for ${key}`);
        }
        yield text;
      }
      written.set(key, text);
    },
    async reconstruct({ moleculeId, model, start, length }) {
      const run = (await molecule(moleculeId)).runs[`${model}:${start}:${length}`];
      if (!run) throw new Error(`No result for ${model} at ${start}, length ${length}`);
      return run;
    },
    space: cached(async () => {
      const [meta, res] = await Promise.all([
        fetchJson<Omit<SpaceData, "points">>(`${base}/space.json`),
        fetch(`${base}/space.bin`),
      ]);
      if (!res.ok) throw new Error(`Couldn't load ${base}/space.bin (${res.status})`);
      return decodeSpace(meta, await res.arrayBuffer());
    }),
  };
}
