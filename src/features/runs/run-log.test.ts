import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MAX_RUNS, runLog, type RunEntry } from "./run-log";

const entry = (i: number): RunEntry => ({
  id: String(i),
  at: 1000 + i,
  moleculeId: "phenol",
  name: "Phenol",
  model: "BiLSTM",
  start: 4,
  length: 2,
  seed: 1337,
  exact: true,
  valid: true,
  tanimoto: 1,
});

describe("runLog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("lists newest first", () => {
    runLog.add(entry(1));
    runLog.add(entry(2));
    expect(runLog.list().map((r) => r.id)).toEqual(["2", "1"]);
  });

  it("caps the history", () => {
    for (let i = 0; i < MAX_RUNS + 10; i++) runLog.add(entry(i));
    expect(runLog.list()).toHaveLength(MAX_RUNS);
    expect(runLog.list()[0].id).toBe(String(MAX_RUNS + 9));
  });

  it("returns an empty list for corrupt storage", () => {
    localStorage.setItem("seqligase-runs", "{not json");
    expect(runLog.list()).toEqual([]);
  });

  it("returns an empty list when storage holds the wrong shape", () => {
    localStorage.setItem("seqligase-runs", '{"a":1}');
    expect(runLog.list()).toEqual([]);
  });

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => runLog.add(entry(1))).not.toThrow();
    expect(runLog.list()).toEqual([]);
  });

  it("restores a cleared history", () => {
    runLog.add(entry(1));
    const before = runLog.list();
    runLog.clear();
    runLog.replace(before);
    expect(runLog.list()).toEqual(before);
  });

  it("clears", () => {
    runLog.add(entry(1));
    runLog.clear();
    expect(runLog.list()).toEqual([]);
  });
});
