import { useEffect, useState } from "react";
import { Header } from "@/app/header";
import { TipProvider } from "@/charts/tooltip";
import { Button } from "@/components/ui/button";
import { client } from "@/engine/client";
import type { ExperimentsData } from "@/engine/types";
import { Segmented } from "@/features/lab/segmented";
import { ConfusionHeatmap } from "./confusion-heatmap";
import { ExperimentTable } from "./experiment-table";
import { MaskSweep } from "./mask-sweep";
import { ModelComparison, type Split } from "./model-comparison";
import { TanimotoHistogram } from "./tanimoto-histogram";
import { TrainingCurves } from "./training-curves";

export function ExperimentsPage() {
  const [data, setData] = useState<ExperimentsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [split, setSplit] = useState<Split>("random");
  const load = () => {
    setError(null);
    client
      .experiments()
      .then(setData, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => {
    let live = true;
    client.experiments().then(
      (d) => {
        if (live) setData(d);
      },
      (e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      live = false;
    };
  }, []);
  const current = data?.splits[split];
  return (
    <>
      <Header
        title="Experiments"
        note="Eight controlled runs across recurrent and transformer architectures, evaluated on held-out QM9 molecules."
        actions={
          <div className="w-[190px]">
            <Segmented<Split>
              label="Split"
              value={split}
              onChange={setSplit}
              options={[
                { value: "random", label: "Random split" },
                { value: "scaffold", label: "Scaffold split" },
              ]}
            />
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1760px] px-4 pt-4 pb-11">
          {error ? (
            <div role="alert" className="flex items-center gap-3 text-xs">
              {error}
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setError(null);
                  load();
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {data && current ? (
            <TipProvider>
              <div className="bg-border grid grid-cols-12 gap-px overflow-hidden rounded-[10px] border">
                <TrainingCurves split={current} />
                <ModelComparison splits={data.splits} active={split} />
                <MaskSweep split={current} ratios={data.maskRatios} />
                <ConfusionHeatmap confusion={current.confusion} />
                <TanimotoHistogram data={current.tanimoto} />
                <ExperimentTable split={current} />
              </div>
            </TipProvider>
          ) : null}
        </div>
      </div>
    </>
  );
}
