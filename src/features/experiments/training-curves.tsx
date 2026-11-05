import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { Area, LinePath } from "@visx/shape";
import { useRef, useState } from "react";
import { ChartFrame } from "@/charts/chart-frame";
import { ChartWidth } from "@/charts/chart-width";
import { useWide } from "@/charts/use-wide";
import { curveDomain, modelColor, resolveBrush } from "@/charts/chart-math";
import { ModelLegend } from "@/charts/legend";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import { Button } from "@/components/ui/button";
import { MODEL_IDS, type ModelId, type SplitData } from "@/engine/types";
import { Segmented } from "@/features/lab/segmented";

const M = { t: 8, r: 14, b: 24, l: 42 };
const FULL: [number, number] = [1, 40];

function Plot({
  width,
  split,
  metric,
  hidden,
  zoom,
  onZoom,
  onEpoch,
}: {
  width: number;
  split: SplitData;
  metric: "acc" | "loss";
  hidden: ReadonlySet<ModelId>;
  zoom: [number, number] | null;
  onZoom: (z: [number, number]) => void;
  onEpoch: (e: number | null) => void;
}) {
  const H = useWide() ? 330 : 290;
  const { show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const range = zoom ?? FULL;
  const visible = MODEL_IDS.filter((m) => !hidden.has(m));
  const series = (m: ModelId) => split.curves[m][metric];
  const x = scaleLinear<number>({ domain: range, range: [M.l, width - M.r] });
  const y = scaleLinear<number>({
    domain: curveDomain(visible.map(series), range),
    range: [H - M.b, M.t],
    nice: true,
  });
  const yTicks = y.ticks(5);
  const xTicks = x.ticks(10).filter((d) => Number.isInteger(d) && x(d) < width - M.r - 44);
  const clip = `clip-curves-${metric}`;
  const pointerX = (e: React.PointerEvent) =>
    e.clientX - (svg.current?.getBoundingClientRect().left ?? 0);
  const epochAt = (px: number) => Math.max(range[0], Math.min(range[1], Math.round(x.invert(px))));

  return (
    <svg
      ref={svg}
      width={width}
      height={H}
      role="img"
      aria-label={`Validation ${metric === "acc" ? "accuracy" : "loss"} by epoch for each model`}
      className="block touch-none"
    >
      <defs>
        <clipPath id={clip}>
          <rect x={M.l} y={M.t - 2} width={width - M.l - M.r} height={H - M.t - M.b + 4} />
        </clipPath>
      </defs>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} className="stroke-border" />
          <text
            x={M.l - 8}
            y={y(t) + 4}
            textAnchor="end"
            className="fill-subtle font-mono text-[11px]"
          >
            {metric === "acc" ? t.toFixed(2) : t.toFixed(1)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text
          key={t}
          x={x(t)}
          y={H - 7}
          textAnchor="middle"
          className="fill-subtle font-mono text-[11px]"
        >
          {t}
        </text>
      ))}
      <text
        x={width - M.r}
        y={H - 7}
        textAnchor="end"
        className="fill-subtle font-mono text-[11px]"
      >
        epoch
      </text>
      <line x1={M.l} x2={width - M.r} y1={H - M.b} y2={H - M.b} className="stroke-border-strong" />
      <g clipPath={`url(#${clip})`}>
        {[...visible].reverse().map((m) => (
          <g key={m}>
            <Area
              data={series(m)}
              x={(p) => x(p.epoch)}
              y0={(p) => y(p.lo)}
              y1={(p) => y(p.hi)}
              curve={curveMonotoneX}
              fill={modelColor(m)}
              opacity={0.18}
            />
            <LinePath
              data={series(m)}
              x={(p) => x(p.epoch)}
              y={(p) => y(p.mean)}
              curve={curveMonotoneX}
              stroke={modelColor(m)}
              strokeWidth={2}
              strokeLinecap="round"
              pathLength={1}
              className="chart-draw"
            />
          </g>
        ))}
      </g>
      {hover !== null ? (
        <g>
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={M.t}
            y2={H - M.b}
            className="stroke-subtle"
            opacity={0.6}
          />
          {visible.map((m) => (
            <circle
              key={m}
              cx={x(hover)}
              cy={y(series(m)[hover - 1].mean)}
              r={4}
              fill={modelColor(m)}
              className="stroke-surface"
              strokeWidth={2}
            />
          ))}
        </g>
      ) : null}
      {drag ? (
        <rect
          x={Math.min(drag.from, drag.to)}
          y={M.t}
          width={Math.abs(drag.to - drag.from)}
          height={H - M.t - M.b}
          className="fill-brand"
          opacity={0.14}
        />
      ) : null}
      <rect
        x={M.l}
        y={M.t}
        width={Math.max(0, width - M.l - M.r)}
        height={H - M.t - M.b}
        fill="transparent"
        className="cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const px = pointerX(e);
          setDrag({ from: px, to: px });
        }}
        onPointerMove={(e) => {
          const px = pointerX(e);
          if (drag) setDrag({ ...drag, to: px });
          const epoch = epochAt(px);
          setHover(epoch);
          onEpoch(epoch);
          show(
            e,
            <>
              <b className="font-medium">Epoch {epoch}</b>
              {visible.map((m) => (
                <TipRow key={m} label={m} value={series(m)[epoch - 1].mean.toFixed(3)} />
              ))}
              <div className="text-subtle">
                {metric === "acc" ? "Validation masked-token accuracy" : "Validation loss"}
              </div>
            </>,
          );
        }}
        onPointerUp={() => {
          if (drag) {
            const next = resolveBrush(x.invert(drag.from), x.invert(drag.to), range);
            if (next) onZoom(next);
          }
          setDrag(null);
        }}
        onPointerLeave={() => {
          setHover(null);
          onEpoch(null);
          hide();
        }}
      />
    </svg>
  );
}

export function TrainingCurves({ split }: { split: SplitData }) {
  const [metric, setMetric] = useState<"acc" | "loss">("acc");
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<ModelId>>(new Set());
  const [epoch, setEpoch] = useState<number | null>(null);
  const shownEpoch = epoch ?? 40;
  const values = Object.fromEntries(
    MODEL_IDS.map((m) => [m, split.curves[m][metric][shownEpoch - 1].mean.toFixed(3)]),
  );
  return (
    <ChartFrame
      title="Training curves"
      note="Three seeds per model, band shows the range. Drag across the plot to zoom."
      className="col-span-12 min-[1600px]:col-span-7"
      actions={
        <>
          {zoom ? (
            <Button variant="outline" size="xs" onClick={() => setZoom(null)}>
              Reset zoom
            </Button>
          ) : null}
          <div className="w-[150px]">
            <Segmented
              label="Metric"
              value={metric}
              onChange={(m) => {
                setMetric(m);
                setZoom(null);
              }}
              options={[
                { value: "acc", label: "Accuracy" },
                { value: "loss", label: "Loss" },
              ]}
            />
          </div>
        </>
      }
    >
      <ModelLegend
        values={values}
        hidden={hidden}
        onToggle={(m) => {
          const next = new Set(hidden);
          if (next.has(m)) next.delete(m);
          else next.add(m);
          setHidden(next);
        }}
      />
      <ChartWidth>
        {({ width }) =>
          width > 0 ? (
            <Plot
              width={width}
              split={split}
              metric={metric}
              hidden={hidden}
              zoom={zoom}
              onZoom={setZoom}
              onEpoch={setEpoch}
            />
          ) : null
        }
      </ChartWidth>
    </ChartFrame>
  );
}
