import type { Properties, ReconstructResponse } from "@/engine/types";

export function formatChange(before: number, after: number, digits: number) {
  const delta = Number((after - before).toFixed(digits));
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(digits)}`;
}

const ROWS: [string, keyof Properties, number][] = [
  ["Mol. weight", "mol_weight", 2],
  ["LogP", "logp", 2],
  ["H-bond donors", "hbd", 0],
  ["H-bond acceptors", "hba", 0],
];

export function propertyRows(original: Properties, predicted: Properties | null) {
  return ROWS.map(([label, key, digits]) => ({
    label,
    original: original[key].toFixed(digits),
    predicted: predicted ? predicted[key].toFixed(digits) : "–",
    change: predicted ? formatChange(original[key], predicted[key], digits) : "–",
  }));
}

export function verdictOf(r: Pick<ReconstructResponse, "exact_recovery" | "valid">) {
  if (!r.valid)
    return { tone: "warn", text: "Invalid: the sequence didn't decode to a molecule" } as const;
  return r.exact_recovery
    ? ({ tone: "good", text: "Exact recovery" } as const)
    : ({ tone: "warn", text: "Partial: valid molecule, different from original" } as const);
}
