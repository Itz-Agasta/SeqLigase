import { scaleLinear } from "@visx/scale";
import { useState } from "react";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { modelColor } from "@/charts/chart-math";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import { type CompareMetric, MODEL_IDS, type SplitData } from "@/engine/types";
import { Segmented } from "@/features/lab/segmented";

const ROW = 38;

export function ModelComparison({ split }: { split: SplitData }) {
  const [metric, setMetric] = useState<CompareMetric>("acc");
  const { show, hide } = useTip();
  const c = split.compare[metric];
  return (
    <ChartFrame
      title="Model comparison"
      note={c.note}
      className="col-span-7"
      actions={
        <div className="w-[320px]">
          <Segmented<CompareMetric>
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={(Object.keys(split.compare) as CompareMetric[]).map((k) => ({
              value: k,
              label: split.compare[k].label,
            }))}
          />
        </div>
      }
    >
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const H = ROW * 4 + 28;
          const x = scaleLinear<number>({ domain: c.domain, range: [64, width - 60] });
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label={`${c.label} by model`}
              className="block"
            >
              {x.ticks(5).map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={4} y2={4 + ROW * 4} className="stroke-border" />
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
              {MODEL_IDS.map((m, i) => {
                const v = c.values[i];
                const ci = c.ci[i];
                const cy = 4 + ROW * i + ROW / 2;
                return (
                  <g key={m}>
                    <text x={0} y={cy + 4} className="fill-muted-foreground text-xs">
                      {m}
                    </text>
                    <line
                      x1={x(v - ci)}
                      x2={x(v + ci)}
                      y1={cy}
                      y2={cy}
                      stroke={modelColor(m)}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={x(v)}
                      cy={cy}
                      r={5}
                      fill={modelColor(m)}
                      className="stroke-surface"
                      strokeWidth={2}
                    />
                    <text
                      x={width}
                      y={cy + 4}
                      textAnchor="end"
                      className="fill-foreground font-mono text-[11px]"
                    >
                      {v.toFixed(3)}
                    </text>
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
                            <b className="font-medium">{m}</b>
                            <TipRow label={c.label} value={v.toFixed(3)} />
                            <TipRow
                              label="95% CI"
                              value={`${(v - ci).toFixed(3)} to ${(v + ci).toFixed(3)}`}
                            />
                            <TipRow label="Seeds" value="3" />
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
