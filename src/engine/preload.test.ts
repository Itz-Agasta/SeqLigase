import { describe, expect, it, vi } from "vite-plus/test";
import { preloadAll } from "./preload";
import type { InferenceClient } from "./types";

function fakeClient(overrides: Partial<InferenceClient> = {}) {
  return {
    catalog: vi.fn(async () => [{ id: "a" }, { id: "b" }, { id: "c" }]),
    molecule: vi.fn(async () => ({})),
    experiments: vi.fn(async () => ({})),
    space: vi.fn(async () => ({})),
    reconstruct: vi.fn(),
    ...overrides,
    notes: vi.fn(async () => ({})),
  } as unknown as InferenceClient;
}

describe("preloadAll", () => {
  it("fetches all data and code", async () => {
    const client = fakeClient();
    const importer = vi.fn(async () => ({}));
    await preloadAll(client, [importer, importer]);
    expect(client.molecule).toHaveBeenCalledTimes(3);
    expect(client.experiments).toHaveBeenCalledTimes(1);
    expect(client.space).toHaveBeenCalledTimes(1);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it("keeps going past failures and never rejects", async () => {
    const client = fakeClient({
      molecule: vi.fn(async (id: string) =>
        id === "a" ? Promise.reject(new Error("x")) : {},
      ) as never,
      space: vi.fn(() => Promise.reject(new Error("y"))),
    });
    await expect(
      preloadAll(client, [() => Promise.reject(new Error("z"))]),
    ).resolves.toBeUndefined();
    expect(client.molecule).toHaveBeenCalledTimes(3);
  });

  it("survives the catalog failing", async () => {
    const client = fakeClient({ catalog: vi.fn(() => Promise.reject(new Error("offline"))) });
    await expect(preloadAll(client, [])).resolves.toBeUndefined();
    expect(client.molecule).not.toHaveBeenCalled();
  });
});
