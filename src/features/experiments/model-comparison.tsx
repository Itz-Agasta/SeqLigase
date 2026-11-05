import { scaleLinear } from "@visx/scale";
import { useState } from "react";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { useWide } from "@/charts/use-wide";
import { modelColor } from "@/charts/chart-math";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import { type CompareMetric, MODEL_IDS, type SplitData } from "@/engine/types";
import { Segmented } from "@/features/lab/segmented";

export type Split = "random" | "scaffold";

const HEAD = 20;
const COLUMN = 52;
const VALUES = COLUMN * 3;
const LABEL = 64;

export function ModelComparison({
  splits,
  active,
}: {
  splits: Record<Split, SplitData>;
  active: Split;
}) {
  const [metric, setMetric] = useState<CompareMetric>("acc");
  const { show, hide } = useTip();
  const ROW = useWide() ? 66 : 38;
  const random = splits.random.compare[metric];
  const scaffold = splits.scaffold.compare[metric];
  const n = splits.random.tanimoto.total.toLocaleString("en");
  return (
    <ChartFrame
      title="Model comparison"
      note={`${random.note} Bars show the 95% interval, n = ${n}.`}
      className="col-span-7 min-[1600px]:col-span-5"
      actions={
        <div className="w-[350px]">
          <Segmented<CompareMetric>
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={(Object.keys(splits.random.compare) as CompareMetric[]).map((k) => ({
              value: k,
              label: splits.random.compare[k].label,
            }))}
          />
        </div>
      }
    >
      <div className="text-muted-foreground mb-1 flex gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <i className="border-muted-foreground size-2.5 rounded-full border-2" />
          Random
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-muted-foreground size-2.5 rounded-full" />
          Scaffold
        </span>
      </div>
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const H = HEAD + ROW * 4 + 24;
          const x = scaleLinear<number>({
            domain: random.domain,
            range: [LABEL, width - VALUES - 12],
          });
          const columns: [string, number, Split | null][] = [
            ["Random", width - COLUMN * 2, "random"],
            ["Scaffold", width - COLUMN, "scaffold"],
            ["Gap", width, null],
          ];
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label={`${random.label} by model on the random and scaffold splits`}
              className="block"
            >
              {x.ticks(5).map((t) => (
                <g key={t}>
                  <line
                    x1={x(t)}
                    x2={x(t)}
                    y1={HEAD}
                    y2={HEAD + ROW * 4}
                    className="stroke-border"
                  />
                  <text
                    x={x(t)}
                    y={H - 5}
                    textAnchor="middle"
                    className="fill-subtle font-mono text-[11px]"
                  >
                    {t.toFixed(2)}
                  </text>
                </g>
              ))}
              {columns.map(([label, right]) => (
                <text key={label} x={right} y={12} textAnchor="end" className="fill-subtle text-xs">
                  {label}
                </text>
              ))}
              {MODEL_IDS.map((m, i) => {
                const a = random.values[i];
                const b = scaffold.values[i];
                const gap = a - b;
                const cy = HEAD + ROW * i + ROW / 2;
                const cell = (split: Split | null) =>
                  split === null || split === active ? "fill-foreground" : "fill-subtle";
                return (
                  <g key={m}>
                    <text x={0} y={cy + 4} className="fill-muted-foreground text-xs">
                      {m}
                    </text>
                    <line
                      x1={x(a)}
                      x2={x(b)}
                      y1={cy}
                      y2={cy}
                      strokeWidth={1}
                      className="stroke-subtle"
                    />
                    {(
                      [
                        ["random", random],
                        ["scaffold", scaffold],
                      ] as const
                    ).map(([split, c]) => (
                      <g key={split} opacity={split === active ? 1 : 0.55}>
                        <line
                          x1={x(c.lo[i])}
                          x2={x(c.hi[i])}
                          y1={cy}
                          y2={cy}
                          stroke={modelColor(m)}
                          strokeWidth={2}
                          strokeLinecap="round"
                        />
                        <circle
                          cx={x(c.values[i])}
                          cy={cy}
                          r={split === "random" ? 4 : 5}
                          fill={split === "random" ? "var(--seq-surface)" : modelColor(m)}
                          stroke={split === "random" ? modelColor(m) : "var(--seq-surface)"}
                          strokeWidth={2}
                        />
                      </g>
                    ))}
                    {[a, b, gap].map((v, j) => (
                      <text
                        key={j}
                        x={columns[j][1]}
                        y={cy + 4}
                        textAnchor="end"
                        className={cell(columns[j][2]) + " font-mono text-[11px]"}
                      >
                        {j === 2 ? `−${v.toFixed(3)}` : v.toFixed(3)}
                      </text>
                    ))}
                    <rect
                      x={0}
                      y={cy - ROW / 2}
                      width={width}
                      height={ROW}
                      fill="transparent"
                      onPointerMove={(e) =>
                        show(
                          e,
                          <>
                            <b className="font-medium">
                              {m}, {random.label.toLowerCase()}
                            </b>
                            <TipRow
                              label="Random"
                              value={`${a.toFixed(3)} (${random.lo[i].toFixed(3)} to ${random.hi[i].toFixed(3)})`}
                            />
                            <TipRow
                              label="Scaffold"
                              value={`${b.toFixed(3)} (${scaffold.lo[i].toFixed(3)} to ${scaffold.hi[i].toFixed(3)})`}
                            />
                            <TipRow label="Gap" value={`−${gap.toFixed(3)}`} />
                          </>,
                        )
                      }
                      onPointerLeave={hide}
                    />
                  </g>
                );
              })}
            </svg>
          );
        }}
      </ChartWidth>
    </ChartFrame>
  );
}
