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
import { ModelComparison } from "./model-comparison";
import { TanimotoHistogram } from "./tanimoto-histogram";
import { TrainingCurves } from "./training-curves";

type Split = "random" | "scaffold";

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
      <Header>
        <b className="text-foreground font-medium">Experiments</b>
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1760px] px-6 pt-[18px] pb-11">
          <div className="mb-3.5 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Experiments</h1>
              <p className="text-muted-foreground">
                Eight controlled runs across recurrent architectures, evaluated on held-out QM9
                molecules.
              </p>
            </div>
            <div className="w-[190px] flex-none">
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
          </div>
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
                <ModelComparison split={current} />
                <MaskSweep split={current} ratios={data.maskRatios} />
                <ConfusionHeatmap confusion={data.confusion} />
                <TanimotoHistogram data={data.tanimoto} />
                <ExperimentTable split={current} />
              </div>
            </TipProvider>
          ) : null}
        </div>
      </div>
    </>
  );
}
