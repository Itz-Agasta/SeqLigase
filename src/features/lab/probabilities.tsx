import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLab } from "@/state/lab-store";

export function Probabilities() {
  const response = useLab((s) => s.response);
  const record = useLab((s) => s.record);
  const setHovered = useLab((s) => s.setHoveredToken);
  const [chosen, setChosen] = useState<number | null>(null);
  if (!response || !record) {
    return (
      <section className="border-b px-3.5 pt-3 pb-3.5">
        <h3 className="text-[12.5px] font-medium">Token probabilities</h3>
        <p className="text-subtle mt-1 text-xs">Available after a run.</p>
      </section>
    );
  }
  const position =
    chosen !== null && response.mask_positions.includes(chosen)
      ? chosen
      : response.mask_positions[0];
  const list = response.topk[String(position)] ?? [];
  const truth = record.tokens[position];
  const wrong = list[0]?.token !== truth;
  return (
    <section
      className="border-b px-3.5 pt-3 pb-3.5"
      onPointerEnter={() => setHovered(position)}
      onPointerLeave={() => setHovered(null)}
    >
      <h3 className="mb-2 flex items-center justify-between text-[12.5px] font-medium">
        Token probabilities
        <span className="text-subtle text-xs font-normal">hover to locate</span>
      </h3>
      <div className="mb-2 flex flex-wrap gap-[3px]">
        {response.mask_positions.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === position}
            onClick={() => setChosen(p)}
            className={cn(
              "text-muted-foreground h-[23px] rounded-[5px] border px-[7px] font-mono text-[11.5px]",
              p === position && "border-border-strong bg-accent text-foreground",
            )}
          >
            pos {p}
          </button>
        ))}
      </div>
      {list.map((c, i) => (
        <div
          key={c.token}
          className={cn(
            "text-muted-foreground grid h-[21px] grid-cols-[92px_1fr_42px] items-center gap-2 font-mono text-[11.5px]",
            i === 0 && "text-foreground",
          )}
        >
          <span className="flex items-baseline gap-1 whitespace-nowrap">
            {c.token}
            {c.token === truth ? (
              <small className="text-good font-sans text-[11px] font-medium">true</small>
            ) : null}
          </span>
          <span className="bg-accent h-1 overflow-hidden rounded-sm">
            <i
              className={cn(
                "block h-full rounded-sm transition-[width] duration-300",
                i === 0 ? (wrong ? "bg-warn" : "bg-brand-text") : "bg-subtle",
              )}
              style={{ width: `${c.p * 100}%` }}
            />
          </span>
          <span className="text-right">{(c.p * 100).toFixed(1)}%</span>
        </div>
      ))}
    </section>
  );
}
