import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createStaticClient } from "./static-client";

const record = {
  id: "phenol",
  runs: { "BiLSTM:4:2": { exact_recovery: true } },
};

function stubFetch(handler: (url: string) => Response) {
  const fn = vi.fn(async (url: string) => handler(url));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("static client", () => {
  it("returns the same response for the same request", async () => {
    const fetch = stubFetch(() => Response.json(record));
    const client = createStaticClient();
    const req = { moleculeId: "phenol", model: "BiLSTM", start: 4, length: 2 } as const;
    expect(await client.reconstruct(req)).toBe(await client.reconstruct(req));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects when a file fails to load, then retries", async () => {
    let ok = false;
    stubFetch(() => (ok ? Response.json(record) : new Response("nope", { status: 500 })));
    const client = createStaticClient();
    await expect(client.molecule("phenol")).rejects.toThrow(/phenol/);
    ok = true;
    await expect(client.molecule("phenol")).resolves.toMatchObject({ id: "phenol" });
  });

  it("rejects a run that does not exist", async () => {
    stubFetch(() => Response.json(record));
    const client = createStaticClient();
    await expect(
      client.reconstruct({ moleculeId: "phenol", model: "RNN", start: 0, length: 3 }),
    ).rejects.toThrow();
  });

  it("decodes chemical space points", async () => {
    const points = new Float32Array([1, 2, 3, 9, 4, 5, 6, 8]);
    stubFetch((url) =>
      url.endsWith(".bin")
        ? new Response(points.buffer)
        : Response.json({ count: 2, stride: 4, formulas: ["C", "O"], catalog: { phenol: 1 } }),
    );
    const space = await createStaticClient().space();
    expect(space.points).toHaveLength(8);
    expect(space.points[7]).toBe(8);
    expect(space.catalog.phenol).toBe(1);
  });
});
