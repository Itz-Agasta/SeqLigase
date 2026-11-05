import { useState } from "react";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { useWide } from "@/charts/use-wide";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import type { ExperimentsData } from "@/engine/types";

const LEFT = 70;
const TOP = 22;
const short = (t: string) => t.replace("Branch", "Br").replace("Ring", "Rg");

export function ConfusionHeatmap({ confusion }: { confusion: ExperimentsData["confusion"] }) {
  const { show, hide } = useTip();
  const CELL_H = useWide() ? 34 : 26;
  const [active, setActive] = useState<[number, number] | null>(null);
  const n = confusion.tokens.length;
  return (
    <ChartFrame
      title="Token confusion, BiLSTM"
      note="Share of each true token predicted as each column. Rows sum to 100%."
      className="col-span-6 min-[1600px]:col-span-4"
    >
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const cell = (width - LEFT - 4) / n;
          const H = TOP + CELL_H * n + 4;
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label="Confusion matrix of true and predicted tokens"
              className="block"
            >
              {confusion.tokens.map((t, i) => (
                <g key={t}>
                  <text
                    x={LEFT - 8}
                    y={TOP + i * CELL_H + CELL_H / 2 + 4}
                    textAnchor="end"
                    className={
                      (active?.[0] === i ? "fill-foreground" : "fill-subtle") +
                      " font-mono text-[11px]"
                    }
                  >
                    {t}
                  </text>
                  <text
                    x={LEFT + i * cell + cell / 2}
                    y={TOP - 7}
                    textAnchor="middle"
                    className={
                      (active?.[1] === i ? "fill-foreground" : "fill-subtle") +
                      " font-mono text-[11px]"
                    }
                  >
                    {short(t)}
                  </text>
                </g>
              ))}
              {confusion.matrix.map((row, i) =>
                row.map((v, j) => (
                  <g key={j}>
                    <rect
                      x={LEFT + j * cell + 1}
                      y={TOP + i * CELL_H + 1}
                      width={cell - 2}
                      height={CELL_H - 2}
                      rx={3}
                      style={{
                        fill: `color-mix(in oklab, var(--seq-brand) ${Math.pow(v, 0.55) * 100}%, var(--seq-surface))`,
                      }}
                      className={
                        active?.[0] === i && active[1] === j ? "stroke-foreground" : undefined
                      }
                      onPointerMove={(e) => {
                        setActive([i, j]);
                        show(
                          e,
                          <>
                            <b className="font-medium">
                              True {confusion.tokens[i]}, predicted {confusion.tokens[j]}
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
                    {i === j && cell > 34 ? (
                      <text
                        x={LEFT + j * cell + cell / 2}
                        y={TOP + i * CELL_H + CELL_H / 2 + 4}
                        textAnchor="middle"
                        className="fill-primary-foreground pointer-events-none font-mono text-[11px]"
                      >
                        {Math.round(v * 100)}
                      </text>
                    ) : null}
                  </g>
                )),
              )}
            </svg>
          );
        }}
      </ChartWidth>
    </ChartFrame>
  );
}
