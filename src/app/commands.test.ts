import { describe, expect, it, vi } from "vite-plus/test";
import { filterCommands, outOfDomainMessage, type Command } from "./commands";

const commands: Command[] = [
  { id: "mol-phenol", label: "Phenol", hint: "C6H6O", group: "Molecules", run: vi.fn() },
  { id: "page-exp", label: "Open Experiments", hint: "Page", group: "Pages", run: vi.fn() },
];

describe("filterCommands", () => {
  it("lists all for an empty query", () => {
    expect(filterCommands(commands, "")).toHaveLength(2);
  });
  it("matches label and hint, ignoring case", () => {
    expect(filterCommands(commands, "phen").map((c) => c.id)).toEqual(["mol-phenol"]);
    expect(filterCommands(commands, "c6h6").map((c) => c.id)).toEqual(["mol-phenol"]);
  });
});

describe("outOfDomainMessage", () => {
  it("explains the model's domain for a molecule outside the set", () => {
    const message = outOfDomainMessage("aspirin", commands);
    expect(message).toMatch(/aspirin/);
    expect(message).toMatch(/9 heavy atoms/);
    expect(message).toMatch(/QM9/);
  });
  it("stays quiet when something matches", () => {
    expect(outOfDomainMessage("phenol", commands)).toBeNull();
  });
  it("stays quiet for an empty query", () => {
    expect(outOfDomainMessage("  ", commands)).toBeNull();
  });
});
