import { useLab } from "@/state/lab-store";
import { cn } from "@/lib/utils";
import { Probabilities } from "./probabilities";
import { PropertiesPanel } from "./properties";
import { ResultPanel } from "./result-panel";
import { RunForm } from "./run-form";

export function Inspector({ onRun }: { onRun: () => void }) {
  const stale = useLab((s) => s.status !== "done");
  return (
    <aside
      data-chrome
      aria-label="Run and results"
      className="bg-background relative z-10 min-h-0 w-[340px] flex-none overflow-y-auto border-l"
    >
      <RunForm onRun={onRun} />
      <div className={cn(stale && "opacity-60")}>
        <ResultPanel />
        <Probabilities />
        <PropertiesPanel />
      </div>
    </aside>
  );
}
