import { scaleLinear } from "@visx/scale";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { useWide } from "@/charts/use-wide";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import type { SplitData } from "@/engine/types";

const M = { t: 8, r: 14, b: 24, l: 34 };

export function TanimotoHistogram({ data }: { data: SplitData["tanimoto"] }) {
  const { show, hide } = useTip();
  const H = useWide() ? 276 : 226;
  const bins = data.bins;
  const others = data.valid - data.exact;
  return (
    <ChartFrame
      title="Structural similarity, T5"
      note={`Morgan Tanimoto to the original, at 15% mask. ${data.valid.toLocaleString("en")} of ${data.total.toLocaleString("en")} outputs are RDKit-valid.`}
      className="col-span-6 min-[1600px]:col-span-4"
    >
      <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">
          <b className="text-foreground font-mono text-base font-medium">
            {data.exact.toLocaleString("en")}
          </b>{" "}
          exact recoveries, {((data.exact / data.total) * 100).toFixed(1)}% of test molecules
        </span>
        <span className="text-muted-foreground">
          <b className="text-foreground font-mono text-base font-medium">{others}</b> other valid
          outputs, charted below
        </span>
      </div>
      <ChartWidth>
        {({ width }) => {
          if (width <= 0) return null;
          const x = scaleLinear<number>({ domain: [0, 1], range: [M.l, width - M.r] });
          const y = scaleLinear<number>({
            domain: [0, Math.max(...bins)],
            range: [H - M.b, M.t],
            nice: true,
          });
          const bw = (width - M.l - M.r) / bins.length;
          return (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label="Distribution of Tanimoto similarity for valid outputs that are not exact recoveries"
              className="block"
            >
              {y.ticks(4).map((t) => (
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
                return (
                  <g key={i}>
                    <path
                      d={`M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}H${left + w - r}Q${left + w},${top} ${left + w},${top + r}V${base}Z`}
                      className="fill-brand"
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
                              label="Share of these outputs"
                              value={`${((v / others) * 100).toFixed(1)}%`}
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
