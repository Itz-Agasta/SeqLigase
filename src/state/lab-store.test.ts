import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { InferenceClient, MoleculeRecord } from "@/engine/types";
import { createLabStore } from "./lab-store";

const tokens = ["[O]", "[C]", "[=C]", "[C]", "[=C]", "[C]", "[=C]", "[Ring1]", "[=Branch1]"];
const run = { exact_recovery: true };
const record = { id: "phenol", tokens, runs: { "BiLSTM:4:2": run } } as unknown as MoleculeRecord;
const client = {
  molecule: vi.fn(async () => record),
  reconstruct: vi.fn(async () => run),
} as unknown as InferenceClient;

describe("lab store", () => {
  let store: ReturnType<typeof createLabStore>;
  beforeEach(async () => {
    store = createLabStore(client);
    await store
      .getState()
      .load({ moleculeId: "phenol", model: "BiLSTM", start: 4, length: 2, seed: 1337 });
  });

  it("starts stale until a run lands", () => {
    expect(store.getState().status).toBe("stale");
    expect(store.getState().record?.id).toBe("phenol");
  });

  it("stores a run response", async () => {
    await store.getState().reconstruct();
    expect(store.getState().status).toBe("done");
    expect(store.getState().response).toBe(run);
  });

  it("goes stale and clears the result when the selection changes", async () => {
    await store.getState().reconstruct();
    store.getState().setMask(1, 1);
    expect(store.getState().status).toBe("stale");
    expect(store.getState().response).toBeNull();
    expect(store.getState().selection).toMatchObject({ start: 1, length: 1 });
  });

  it("recomputes the mask when ratio or seed change", () => {
    const before = store.getState().selection;
    store.getState().setMaskPolicy({ ratio: 35, maxSpan: 3, seed: 3 });
    const after = store.getState().selection;
    expect(after.seed).toBe(3);
    expect(after.length).toBeLessThanOrEqual(3);
    expect(store.getState().status).toBe("stale");
    expect(before.seed).toBe(1337);
  });

  it("ignores changes during a run", () => {
    store.setState({ status: "running" });
    store.getState().setMask(0, 1);
    expect(store.getState().selection.start).toBe(4);
  });

  it("clamps a span past the end when loading", async () => {
    await store
      .getState()
      .load({ moleculeId: "phenol", model: "BiLSTM", start: 40, length: 3, seed: 1 });
    expect(store.getState().selection).toMatchObject({ start: 6, length: 3 });
  });

  it("reports load errors", async () => {
    (client.molecule as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    await store
      .getState()
      .load({ moleculeId: "phenol", model: "BiLSTM", start: 4, length: 2, seed: 1 });
    expect(store.getState().error).toMatch(/offline/);
  });
});
