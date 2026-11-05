import { modelColor } from "@/charts/chart-math";
import { MODEL_IDS, type ModelId } from "@/engine/types";
import { cn } from "@/lib/utils";

export function ModelLegend({
  values,
  hidden,
  onToggle,
}: {
  values?: Partial<Record<ModelId, string>>;
  hidden?: ReadonlySet<ModelId>;
  onToggle?: (m: ModelId) => void;
}) {
  return (
    <div className="mb-1 -ml-1.5 flex flex-wrap gap-1">
      {MODEL_IDS.map((m) => {
        const inner = (
          <>
            <i className="h-0.5 w-3 rounded-[1px]" style={{ background: modelColor(m) }} />
            {m}
            {values?.[m] ? (
              <em className="text-foreground min-w-[38px] text-left font-mono text-[11.5px] not-italic">
                {values[m]}
              </em>
            ) : null}
          </>
        );
        const style =
          "text-muted-foreground flex items-center gap-1.5 rounded-[5px] px-1.5 py-0.5 text-xs";
        return onToggle ? (
          <button
            key={m}
            type="button"
            aria-pressed={!hidden?.has(m)}
            onClick={() => onToggle(m)}
            className={cn(style, "hover:bg-secondary", hidden?.has(m) && "opacity-40")}
          >
            {inner}
          </button>
        ) : (
          <span key={m} className={style}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}
