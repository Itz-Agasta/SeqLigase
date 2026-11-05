import { scaleLinear, scalePoint } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { useWide } from "@/charts/use-wide";
import { modelColor } from "@/charts/chart-math";
import { ModelLegend } from "@/charts/legend";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import { MODEL_IDS, type SplitData } from "@/engine/types";

const M = { t: 8, r: 12, b: 22, l: 38 };

export function MaskSweep({ split, ratios }: { split: SplitData; ratios: number[] }) {
  const { show, hide } = useTip();
  const H = useWide() ? 258 : 166;
  return (
    <ChartFrame
      title="Difficulty by mask ratio"
      note="Masked-token accuracy over all masked positions."
      className="col-span-5 min-[1600px]:col-span-4"
    >
      <ModelLegend />
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const x = scalePoint<number>({ domain: ratios, range: [M.l + 14, width - M.r - 14] });
          const y = scaleLinear<number>({ domain: [0.4, 0.9], range: [H - M.b, M.t] });
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label="Masked-token accuracy at each mask ratio by model"
              className="block"
            >
              {[0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => (
                <g key={t}>
                  <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} className="stroke-border" />
                  <text
                    x={M.l - 8}
                    y={y(t) + 4}
                    textAnchor="end"
                    className="fill-subtle font-mono text-[11px]"
                  >
                    {t.toFixed(1)}
                  </text>
                </g>
              ))}
              {ratios.map((r) => (
                <text
                  key={r}
                  x={x(r)}
                  y={H - 5}
                  textAnchor="middle"
                  className="fill-subtle font-mono text-[11px]"
                >
                  {r}%
                </text>
              ))}
              {MODEL_IDS.map((m) => {
                const points = split.sweep[m].map((v, i) => ({ r: ratios[i], v }));
                return (
                  <g key={m}>
                    <LinePath
                      data={points}
                      x={(p) => x(p.r) ?? 0}
                      y={(p) => y(p.v)}
                      stroke={modelColor(m)}
                      strokeWidth={2}
                      pathLength={1}
                      className="chart-draw"
                    />
                    {points.map((p) => (
                      <g key={p.r}>
                        <circle
                          cx={x(p.r)}
                          cy={y(p.v)}
                          r={4}
                          fill={modelColor(m)}
                          className="stroke-surface"
                          strokeWidth={2}
                        />
                        <circle
                          cx={x(p.r)}
                          cy={y(p.v)}
                          r={12}
                          fill="transparent"
                          onPointerMove={(e) =>
                            show(
                              e,
                              <>
                                <b className="font-medium">
                                  {m}, {p.r}% masked
                                </b>
                                <TipRow label="Token accuracy" value={p.v.toFixed(3)} />
                              </>,
                            )
                          }
                          onPointerLeave={hide}
                        />
                      </g>
                    ))}
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
