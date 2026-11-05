import { ChartFrame } from "@/charts/chart-frame";
import type { SplitData } from "@/engine/types";
import { cn } from "@/lib/utils";

const HEAD = ["ID", "Input", "Model", "Mask", "Token acc.", "Top-3", "Exact", "Validity"];
const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(3).replace(/^0/, ""));

export function ExperimentTable({ split }: { split: SplitData }) {
  return (
    <ChartFrame
      title="Experiment matrix"
      note="Token metrics count masked positions. Exact recovery counts test molecules. Validity counts generated candidates. E1 is a fingerprint baseline with no sequence output, and E8 reports validity only."
      className="col-span-12 pb-1.5"
    >
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {HEAD.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "text-subtle border-b px-2 py-1.5 font-normal whitespace-nowrap",
                  i < 4 ? "text-left" : "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {split.table.map((r, i) => {
            const best = r.id === "E5";
            return (
              <tr
                key={i}
                className="hover:bg-secondary transition-colors [&:last-child>td]:border-0"
              >
                <td className="border-b px-2 py-[7px] font-mono text-xs">{r.id}</td>
                <td className="text-muted-foreground border-b px-2 py-[7px]">{r.input}</td>
                <td className="text-muted-foreground border-b px-2 py-[7px]">{r.model}</td>
                <td className="border-b px-2 py-[7px] font-mono text-xs">{r.mask}</td>
                {r.values.map((v, j) => (
                  <td
                    key={j}
                    className={cn(
                      "border-b px-2 py-[7px] text-right font-mono text-xs",
                      v === null && "text-subtle",
                      best && j < 3 && "text-brand-text font-medium",
                    )}
                  >
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ChartFrame>
  );
}
