import { describe, expect, it } from "vite-plus/test";
import { bondSegments, centroid } from "./geometry";

const atom = (x: number, y: number, z = 0) => ({ el: "C", x, y, z, tokenIndex: null });

describe("bondSegments", () => {
  it("makes two half cylinders for a single bond", () => {
    const segs = bondSegments([atom(0, 0), atom(1.5, 0)], [{ a: 0, b: 1, order: 1 }]);
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.owner)).toEqual([0, 1]);
    expect(segs[0].to).toEqual([0.75, 0, 0]);
  });

  it("makes four half cylinders for a double bond, offset in the molecular plane", () => {
    const segs = bondSegments(
      [atom(0, 0), atom(1.3, 0), atom(-1, 1), atom(2.3, 1)],
      [
        { a: 0, b: 1, order: 2 },
        { a: 0, b: 2, order: 1 },
        { a: 1, b: 3, order: 1 },
      ],
    );
    const dbl = segs.filter((s) => s.bond === 0);
    expect(dbl).toHaveLength(4);
    for (const s of dbl) {
      expect(s.from[2]).toBeCloseTo(0);
      expect(Math.abs(s.from[1])).toBeGreaterThan(0.05);
    }
  });

  it("makes four half cylinders for an aromatic bond with a thin inner line toward the ring", () => {
    const hex = [0, 1, 2, 3, 4, 5].map((i) =>
      atom(Math.cos((i * Math.PI) / 3) * 1.4, Math.sin((i * Math.PI) / 3) * 1.4),
    );
    const bonds = [0, 1, 2, 3, 4, 5].map((i) => ({ a: i, b: (i + 1) % 6, order: 1.5 }));
    const segs = bondSegments(hex, bonds).filter((s) => s.bond === 0);
    expect(segs).toHaveLength(4);
    const inner = segs.filter((s) => s.kind === "inner");
    expect(inner).toHaveLength(2);
    const r = (p: number[]) => Math.hypot(p[0], p[1]);
    expect(r(inner[0].from)).toBeLessThan(1.4);
    expect(inner[0].radius).toBeLessThan(segs.find((s) => s.kind === "main")!.radius);
  });

  it("gives a triple bond two extra lines", () => {
    expect(bondSegments([atom(0, 0), atom(1.2, 0)], [{ a: 0, b: 1, order: 3 }])).toHaveLength(6);
  });

  it("makes hydrogen bonds thinner", () => {
    const segs = bondSegments([atom(0, 0), { ...atom(1, 0), el: "H" }], [{ a: 0, b: 1, order: 1 }]);
    expect(segs[0].radius).toBeLessThan(0.05);
  });
});

describe("centroid", () => {
  it("averages positions", () => {
    expect(centroid([atom(0, 0), atom(2, 4)])).toEqual([1, 2, 0]);
  });
});
