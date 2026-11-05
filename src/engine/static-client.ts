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

export function createStaticClient(base = "/data"): InferenceClient {
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
      return { ...meta, points: new Float32Array(await res.arrayBuffer()) };
    }),
  };
}
