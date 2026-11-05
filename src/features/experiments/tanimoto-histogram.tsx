import { scaleLinear, scaleSqrt } from "@visx/scale";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { useWide } from "@/charts/use-wide";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import type { ExperimentsData } from "@/engine/types";

const M = { t: 8, r: 14, b: 24, l: 40 };

export function TanimotoHistogram({ data }: { data: ExperimentsData["tanimoto"] }) {
  const { show, hide } = useTip();
  const H = useWide() ? 296 : 240;
  const bins = data.bins;
  return (
    <ChartFrame
      title="Structural similarity, T5"
      note={`Morgan Tanimoto to the original, over RDKit-valid outputs (n = ${data.valid.toLocaleString("en")} of ${data.total.toLocaleString("en")}). Square-root scale.`}
      className="col-span-6 min-[1600px]:col-span-4"
    >
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const x = scaleLinear<number>({ domain: [0, 1], range: [M.l, width - M.r] });
          const y = scaleSqrt<number>({ domain: [0, 1150], range: [H - M.b, M.t] });
          const bw = (width - M.l - M.r) / bins.length;
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label="Distribution of Tanimoto similarity"
              className="block"
            >
              {[0, 100, 250, 500, 1000].map((t) => (
                <g key={t}>
                  <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} className="stroke-border" />
                  <text
                    x={M.l - 8}
                    y={y(t) + 4}
                    textAnchor="end"
                    className="fill-subtle font-mono text-[11px]"
                  >
                    {t}
                  </text>
                </g>
              ))}
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
                <text
                  key={t}
                  x={x(t)}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-subtle font-mono text-[11px]"
                >
                  {t.toFixed(1)}
                </text>
              ))}
              {bins.map((v, i) => {
                const left = M.l + i * bw + 1;
                const w = bw - 2;
                const top = y(v);
                const base = H - M.b;
                const r = Math.min(4, base - top);
                const lo = i / bins.length;
                const exact = i === bins.length - 1;
                return (
                  <g key={i}>
                    <path
                      d={`M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}H${left + w - r}Q${left + w},${top} ${left + w},${top + r}V${base}Z`}
                      className={exact ? "fill-brand" : "fill-subtle"}
                      opacity={exact ? 1 : 0.65}
                    />
                    <rect
                      x={M.l + i * bw}
                      y={M.t}
                      width={bw}
                      height={H - M.t - M.b}
                      fill="transparent"
                      onPointerMove={(e) =>
                        show(
                          e,
                          <>
                            <b className="font-medium">
                              Tanimoto {lo.toFixed(2)} to {(lo + 1 / bins.length).toFixed(2)}
                            </b>
                            <TipRow label="Molecules" value={v.toLocaleString("en")} />
                            <TipRow
                              label="Share of valid"
                              value={`${((v / data.valid) * 100).toFixed(1)}%`}
                            />
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
