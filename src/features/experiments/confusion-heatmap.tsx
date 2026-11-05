import { useState } from "react";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { useWide } from "@/charts/use-wide";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import type { SplitData } from "@/engine/types";

const LEFT = 94;
const TOP = 40;
const OTHER_GAP = 6;
const ERROR_MAX = 0.1;
const PRINT_FROM = 0.03;
// Above this mix the cell is bright enough that the inverse text reads better, in both themes.
const STRONG_FROM = 88;
const short = (t: string) => t.replace("Branch", "Br").replace("Ring", "Rg");
const errorMix = (v: number) => Math.min(1, v / ERROR_MAX) * 100;

export function ConfusionHeatmap({ confusion }: { confusion: SplitData["confusion"] }) {
  const { show, hide } = useTip();
  const CELL_H = useWide() ? 30 : 24;
  const [active, setActive] = useState<[number, number] | null>(null);
  const rows = confusion.tokens.length;
  const columns = [...confusion.tokens, "Other"];
  const label = (on: boolean) =>
    (on ? "fill-foreground" : "fill-subtle") + " font-mono text-[11px]";
  return (
    <ChartFrame
      title="Token confusion, T5"
      note={`Share of each true token predicted as each column, at 15% mask. The ${rows} most frequent of ${confusion.tokenCount} tokens. Other gathers the rest, so rows sum to 100%.`}
      className="col-span-6 min-[1600px]:col-span-4"
    >
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const cell = (width - LEFT - OTHER_GAP - 4) / columns.length;
          const H = TOP + CELL_H * rows + 4;
          const left = (j: number) => LEFT + j * cell + (j === rows ? OTHER_GAP : 0);
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label="Confusion matrix of true and predicted tokens"
              className="block"
            >
              <text x={LEFT} y={12} className="fill-muted-foreground text-xs">
                Predicted
              </text>
              <text
                x={0}
                y={0}
                transform={`translate(10, ${TOP + (CELL_H * rows) / 2}) rotate(-90)`}
                textAnchor="middle"
                className="fill-muted-foreground text-xs"
              >
                True
              </text>
              {columns.map((t, j) => (
                <text
                  key={t}
                  x={left(j) + cell / 2}
                  y={TOP - 7}
                  textAnchor="middle"
                  className={label(active?.[1] === j)}
                >
                  {short(t)}
                </text>
              ))}
              {confusion.tokens.map((t, i) => (
                <text
                  key={t}
                  x={LEFT - 8}
                  y={TOP + i * CELL_H + CELL_H / 2 + 4}
                  textAnchor="end"
                  className={label(active?.[0] === i)}
                >
                  {t}
                </text>
              ))}
              {confusion.matrix.map((row, i) =>
                row.map((v, j) => {
                  const correct = i === j;
                  const printed = correct || v >= PRINT_FROM;
                  const strong = !correct && errorMix(v) >= STRONG_FROM;
                  return (
                    <g key={j}>
                      <rect
                        x={left(j) + 1}
                        y={TOP + i * CELL_H + 1}
                        width={cell - 2}
                        height={CELL_H - 2}
                        rx={3}
                        style={
                          correct
                            ? { fill: "var(--secondary)" }
                            : {
                                fill: `color-mix(in oklab, var(--seq-brand) ${errorMix(v)}%, var(--seq-surface))`,
                              }
                        }
                        className={
                          active?.[0] === i && active[1] === j ? "stroke-foreground" : undefined
                        }
                        onPointerMove={(e) => {
                          setActive([i, j]);
                          show(
                            e,
                            <>
                              <b className="font-medium">
                                True {confusion.tokens[i]}, predicted {columns[j]}
                              </b>
                              <TipRow label="Share of row" value={`${(v * 100).toFixed(1)}%`} />
                            </>,
                          );
                        }}
                        onPointerLeave={() => {
                          setActive(null);
                          hide();
                        }}
                      />
                      {printed && cell > 30 ? (
                        <text
                          x={left(j) + cell / 2}
                          y={TOP + i * CELL_H + CELL_H / 2 + 4}
                          textAnchor="middle"
                          className={
                            (strong ? "fill-primary-foreground" : "fill-foreground") +
                            " pointer-events-none font-mono text-[11px]"
                          }
                        >
                          {correct ? Math.round(v * 100) : (v * 100).toFixed(1)}
                        </text>
                      ) : null}
                    </g>
                  );
                }),
              )}
            </svg>
          );
        }}
      </ChartWidth>
      <div className="text-subtle mt-1.5 flex items-center justify-end gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <i className="bg-secondary h-2.5 w-3.5 rounded-[2px]" />
          Correct
        </span>
        <span className="flex items-center gap-1.5">
          Errors 0%
          <i
            className="h-2.5 w-20 rounded-[2px]"
            style={{
              background:
                "linear-gradient(in oklab to right, var(--seq-surface), var(--seq-brand))",
            }}
          />
          10%
        </span>
      </div>
    </ChartFrame>
  );
}
