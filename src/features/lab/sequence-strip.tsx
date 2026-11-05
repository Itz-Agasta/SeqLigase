import { useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MoleculeRecord } from "@/engine/types";
import { cn } from "@/lib/utils";
import { useLab } from "@/state/lab-store";
import { useTokenSelection } from "./use-token-selection";

const CHIP =
  "relative flex h-[30px] select-none items-center justify-center overflow-hidden rounded-md border px-[3px] font-mono text-xs whitespace-nowrap transition-colors duration-100";

function tokenRole(record: MoleculeRecord, i: number) {
  const kind = record.tokenKinds[i];
  const atom = record.atomTokens.indexOf(i);
  if (atom >= 0) return `Encodes atom ${record.atoms[atom]?.el}${atom + 1}`;
  if (kind === "ring") return "Closes a ring";
  if (kind === "branch") return "Opens a branch";
  if (kind === "size") return "Sets the size of the ring or branch before it";
  return "Adds no atom here";
}

export function SequenceStrip() {
  const record = useLab((s) => s.record);
  const selection = useLab((s) => s.selection);
  const response = useLab((s) => s.response);
  const status = useLab((s) => s.status);
  const hovered = useLab((s) => s.hoveredToken);
  const displayed = useLab((s) => s.displayed);
  const setMask = useLab((s) => s.setMask);
  const setHovered = useLab((s) => s.setHoveredToken);
  const tokens = record?.tokens ?? [];
  const select = useTokenSelection({
    count: tokens.length,
    start: selection.start,
    length: selection.length,
    onChange: setMask,
  });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const up = () => select.pointerUp();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [select]);

  if (!record)
    return (
      <div className="bg-background relative z-10 h-[158px] flex-none border-b" aria-busy="true" />
    );

  const masked = (i: number) => i >= selection.start && i < selection.start + selection.length;
  const hoverProps = (i: number) => ({
    onPointerEnter: () => {
      select.pointerEnter(i);
      setHovered(i);
    },
    onPointerLeave: () => setHovered(null),
  });
  const maskProps = (i: number) => ({
    ...hoverProps(i),
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      select.pointerDown(i);
    },
  });

  return (
    <section
      data-chrome
      aria-label="SELFIES sequence"
      className="bg-background relative z-10 flex-none border-b px-4 pt-3 pb-3.5"
    >
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <h2 className="text-[13px] font-medium">SELFIES sequence</h2>
        <span className="text-subtle text-xs">
          {tokens.length} tokens, {selection.length} masked. Drag across the Masked row to change
          the mask.
        </span>
        <span className="text-subtle ml-auto font-mono text-xs">{record.smiles}</span>
      </div>
      <TooltipProvider delayDuration={250}>
        <div
          className="grid items-stretch gap-1"
          style={{ gridTemplateColumns: `62px repeat(${tokens.length}, minmax(max-content, 1fr))` }}
        >
          <div />
          {tokens.map((_, i) => (
            <div key={i} className="text-subtle pb-px text-center font-mono text-[11px]">
              {i}
            </div>
          ))}

          <div className="text-subtle self-center text-xs">Original</div>
          {tokens.map((t, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  {...hoverProps(i)}
                  className={cn(
                    CHIP,
                    "bg-surface text-muted-foreground",
                    hovered === i && "bg-accent border-muted-foreground text-foreground",
                  )}
                >
                  {t}
                </div>
              </TooltipTrigger>
              <TooltipContent className="font-sans">
                <span className="font-mono">{t}</span>. {tokenRole(record, i)}
              </TooltipContent>
            </Tooltip>
          ))}

          <div className="text-subtle self-center text-xs" id="mask-row-label">
            Masked
          </div>
          {tokens.map((t, i) => (
            <button
              key={i}
              type="button"
              ref={(el) => {
                refs.current[i] = el;
              }}
              aria-pressed={masked(i)}
              aria-label={`Token ${i}, ${t}${masked(i) ? ", masked" : ""}`}
              disabled={status === "running"}
              tabIndex={select.focus === i ? 0 : -1}
              {...maskProps(i)}
              onKeyDown={(e) => {
                if (select.keyDown(e, i)) e.preventDefault();
                const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
                if (next !== null) refs.current[next]?.focus();
              }}
              className={cn(
                CHIP,
                "touch-none",
                masked(i)
                  ? "border-border-strong text-subtle border-dashed"
                  : "bg-surface text-subtle hover:border-border-strong",
                hovered === i && "bg-accent text-foreground",
              )}
            >
              {masked(i) ? "[MASK]" : t}
            </button>
          ))}

          <div className="text-subtle self-center text-xs">Predicted</div>
          {tokens.map((t, i) => {
            const flicker = displayed[i];
            const top = response?.topk[String(i)]?.[0];
            const shown = flicker?.token ?? top?.token;
            if (!masked(i) || !shown) {
              return (
                <div
                  key={i}
                  {...hoverProps(i)}
                  className={cn(
                    CHIP,
                    masked(i)
                      ? "border-border-strong text-subtle border-dashed"
                      : "bg-surface text-subtle",
                    hovered === i && "bg-accent text-foreground",
                  )}
                >
                  {masked(i) ? "…" : t}
                </div>
              );
            }
            const wrong = shown !== t && (flicker ? flicker.locked : true);
            const confidence = flicker?.p ?? top?.p ?? 0;
            return (
              <div
                key={i}
                {...hoverProps(i)}
                className={cn(
                  CHIP,
                  "font-medium",
                  wrong
                    ? "border-warn bg-warn-wash text-warn"
                    : "border-brand bg-brand-wash text-brand-text",
                )}
                title={flicker ? undefined : `${(confidence * 100).toFixed(1)}% confidence`}
              >
                {shown}
                <i
                  className={cn(
                    "absolute bottom-0 left-0 h-0.5",
                    wrong ? "bg-warn" : "bg-brand-text",
                  )}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    </section>
  );
}
