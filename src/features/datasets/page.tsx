import { lazy, Suspense, useEffect, useState } from "react";
import { Header } from "@/app/header";
import { TipProvider } from "@/charts/tooltip";
import { client } from "@/engine/client";
import type { CatalogEntry, ExperimentsData, SpaceData } from "@/engine/types";
import { Funnel } from "./funnel";
import { Sources } from "./sources";

const ChemicalSpace = lazy(() =>
  import("./chemical-space").then((m) => ({ default: m.ChemicalSpace })),
);

export function DatasetsPage() {
  const [experiments, setExperiments] = useState<ExperimentsData | null>(null);
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const fail = (e: unknown) => {
      if (live) setError(e instanceof Error ? e.message : String(e));
    };
    void client.experiments().then((d) => live && setExperiments(d), fail);
    void client.space().then((d) => live && setSpace(d), fail);
    void client.catalog().then((d) => live && setCatalog(d), fail);
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <Header title="Datasets" note="Where the molecules come from, and how they’re cleaned." />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1760px] px-4 pt-4 pb-11">
          {error ? (
            <p role="alert" className="mb-3 text-xs">
              {error} Reload the page to try again.
            </p>
          ) : null}
          <TipProvider>
            <div className="bg-border grid grid-cols-12 gap-px overflow-hidden rounded-[10px] border">
              <Suspense
                fallback={
                  <div className="bg-surface col-span-12 h-[580px] min-[1600px]:h-[720px]" />
                }
              >
                {space && catalog.length ? (
                  <ChemicalSpace space={space} catalog={catalog} />
                ) : (
                  <div className="bg-surface col-span-12 h-[580px] min-[1600px]:h-[720px]" />
                )}
              </Suspense>
              {experiments ? <Funnel steps={experiments.funnel} /> : null}
              <Sources />
            </div>
          </TipProvider>
        </div>
      </div>
    </>
  );
}
