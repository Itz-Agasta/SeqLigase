import { useEffect, useState } from "react";
import { Header } from "@/app/header";
import { client } from "@/engine/client";
import type { ExperimentsData } from "@/engine/types";
import { ArchitectureTable } from "./architecture-table";
import { CompareRace } from "./compare-race";

export function ModelsPage() {
  const [data, setData] = useState<ExperimentsData | null>(null);
  useEffect(() => {
    void client.experiments().then(setData);
  }, []);
  return (
    <>
      <Header
        title="Models"
        note="Four recurrent architectures, compared on the same masked input."
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1760px] px-4 pt-4 pb-11">
          <div className="bg-border grid grid-cols-12 gap-px overflow-hidden rounded-[10px] border">
            <CompareRace />
            {data ? <ArchitectureTable data={data} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
