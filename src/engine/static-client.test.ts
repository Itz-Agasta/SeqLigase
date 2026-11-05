import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createStaticClient, NoteUnavailableError } from "./static-client";

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
      client.reconstruct({ moleculeId: "phenol", model: "T5", start: 0, length: 3 }),
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

  describe("explain", () => {
    const req = { moleculeId: "phenol", model: "T5", start: 4, length: 2 } as const;
    const collect = async (it: AsyncIterable<string>) => {
      let text = "";
      for await (const chunk of it) text += chunk;
      return text;
    };
    const route = (api: () => Response, notes: Record<string, string> = {}) =>
      stubFetch((url) => (url.includes("/api/") ? api() : Response.json(notes)));

    it("streams the note and keeps it for the same run", async () => {
      const fetch = route(() => new Response("A note."));
      const client = createStaticClient();
      expect(await collect(client.explain(req))).toBe("A note.");
      expect(await collect(client.explain(req))).toBe("A note.");
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("uses the saved note when the function fails", async () => {
      route(() => new Response("down", { status: 503 }), { "phenol:T5:4:2": "Saved note." });
      expect(await collect(createStaticClient().explain(req))).toBe("Saved note.");
    });

    it("treats an empty stream as a failure", async () => {
      route(() => new Response(""), { "phenol:T5:4:2": "Saved note." });
      expect(await collect(createStaticClient().explain(req))).toBe("Saved note.");
    });

    it("doesn't show a static host's HTML as a note", async () => {
      route(() => new Response("<!doctype html>", { headers: { "content-type": "text/html" } }), {
        "phenol:T5:4:2": "Saved note.",
      });
      expect(await collect(createStaticClient().explain(req))).toBe("Saved note.");
    });

    it("says a retry won't help when notes aren't available", async () => {
      route(() => new Response("down", { status: 503 }));
      await expect(collect(createStaticClient().explain(req))).rejects.toBeInstanceOf(
        NoteUnavailableError,
      );
    });

    it("rejects when there is no saved note, then can retry", async () => {
      let ok = false;
      route(() => (ok ? new Response("Live.") : new Response("down", { status: 500 })));
      const client = createStaticClient();
      await expect(collect(client.explain(req))).rejects.toThrow(/No note/);
      ok = true;
      expect(await collect(client.explain(req))).toBe("Live.");
    });
  });
});
