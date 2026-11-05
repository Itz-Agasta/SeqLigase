import type { InferenceClient } from "./types";

const ignore = () => undefined;

/** Loads everything ahead of time so the app keeps working if the network drops. */
export async function preloadAll(client: InferenceClient, importers: (() => Promise<unknown>)[]) {
  await Promise.all(importers.map((load) => load().catch(ignore)));
  const catalog = await client.catalog().catch(() => []);
  await Promise.all([
    client.experiments().catch(ignore),
    client.space().catch(ignore),
    client.notes().catch(ignore),
    ...catalog.map((c) => client.molecule(c.id).catch(ignore)),
  ]);
}
