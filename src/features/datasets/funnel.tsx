import { ChartFrame } from "@/charts/chart-frame";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import type { ExperimentsData } from "@/engine/types";

export function Funnel({ steps }: { steps: ExperimentsData["funnel"] }) {
  const { show, hide } = useTip();
  const top = steps[0]?.count ?? 1;
  return (
    <ChartFrame
      title="Preprocessing funnel"
      note="Molecules remaining after each cleaning step, measured from the QM9 source file."
      className="col-span-7"
    >
      <div className="flex flex-col gap-1.5">
        {steps.map((s, i) => {
          const dropped = i > 0 ? steps[i - 1].count - s.count : 0;
          return (
            <div
              key={s.step}
              className="grid grid-cols-[150px_1fr_64px] items-center gap-3 text-xs"
              onPointerMove={(e) =>
                show(
                  e,
                  <>
                    <b className="font-medium">{s.step}</b>
                    <TipRow label="Remaining" value={s.count.toLocaleString("en")} />
                    {i > 0 ? (
                      <TipRow label="Removed here" value={dropped.toLocaleString("en")} />
                    ) : null}
                  </>,
                )
              }
              onPointerLeave={hide}
            >
              <span className="text-muted-foreground truncate">{s.step}</span>
              <span className="bg-accent h-1.5 overflow-hidden rounded-sm">
                <i
                  className="bg-brand block h-full rounded-sm"
                  style={{ width: `${(s.count / top) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono">{s.count.toLocaleString("en")}</span>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}
