import { scaleLinear, scalePoint } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { modelColor, spreadLabels } from "@/charts/chart-math";
import { useWide } from "@/charts/use-wide";
import { ModelLegend } from "@/charts/legend";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import { MODEL_IDS, type SplitData } from "@/engine/types";

const M = { t: 8, r: 128, b: 22, l: 38 };
const LABEL_GAP = 14;
const OFFSET = 4;

export function MaskSweep({ split, ratios }: { split: SplitData; ratios: number[] }) {
  const { show, hide } = useTip();
  const H = useWide() ? 258 : 180;
  return (
    <ChartFrame
      title="Difficulty by mask ratio"
      note={`Masked-token accuracy over all masked positions. Bars show the 95% interval, n = ${split.tanimoto.total.toLocaleString("en")}.`}
      className="col-span-5 min-[1600px]:col-span-4"
    >
      <ModelLegend />
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const x = scalePoint<number>({ domain: ratios, range: [M.l + 14, width - M.r] });
          const y = scaleLinear<number>({ domain: [0.4, 1], range: [H - M.b, M.t] });
          const last = ratios.length - 1;
          const labelY = spreadLabels(
            MODEL_IDS.map((m) => y(split.sweep[m][last].value)),
            LABEL_GAP,
          );
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label="Masked-token accuracy at each mask ratio by model"
              className="block"
            >
              {[0.4, 0.6, 0.8, 1].map((t) => (
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
              {MODEL_IDS.map((m, mi) => {
                const dx = (mi - (MODEL_IDS.length - 1) / 2) * OFFSET;
                const points = split.sweep[m].map((p, i) => ({ ...p, r: ratios[i] }));
                const px = (r: number) => (x(r) ?? 0) + dx;
                return (
                  <g key={m}>
                    <LinePath
                      data={points}
                      x={(p) => px(p.r)}
                      y={(p) => y(p.value)}
                      stroke={modelColor(m)}
                      strokeWidth={2}
                      pathLength={1}
                      className="chart-draw"
                    />
                    {points.map((p) => (
                      <g key={p.r}>
                        <line
                          x1={px(p.r)}
                          x2={px(p.r)}
                          y1={y(p.lo)}
                          y2={y(p.hi)}
                          stroke={modelColor(m)}
                          strokeWidth={2}
                          strokeLinecap="round"
                        />
                        <circle
                          cx={px(p.r)}
                          cy={y(p.value)}
                          r={4}
                          fill={modelColor(m)}
                          className="stroke-surface"
                          strokeWidth={2}
                        />
                        <circle
                          cx={px(p.r)}
                          cy={y(p.value)}
                          r={12}
                          fill="transparent"
                          onPointerMove={(e) =>
                            show(
                              e,
                              <>
                                <b className="font-medium">
                                  {m}, {p.r}% masked
                                </b>
                                <TipRow label="Token accuracy" value={p.value.toFixed(3)} />
                                <TipRow
                                  label="95% interval"
                                  value={`${p.lo.toFixed(3)} to ${p.hi.toFixed(3)}`}
                                />
                              </>,
                            )
                          }
                          onPointerLeave={hide}
                        />
                      </g>
                    ))}
                    <text
                      x={width - M.r + 14}
                      y={labelY[mi] + 4}
                      className="fill-muted-foreground text-xs"
                    >
                      {m}{" "}
                      <tspan className="fill-foreground font-mono text-[11px]">
                        {points[last].value.toFixed(3)}
                      </tspan>
                    </text>
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
