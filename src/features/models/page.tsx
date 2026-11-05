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
        note="Four architectures, recurrent and transformer, compared on the same masked input."
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex min-h-[620px] w-full max-w-[1760px] flex-1 flex-col px-4 py-4">
          <div className="bg-border flex min-h-0 flex-1 flex-col gap-px overflow-hidden rounded-[10px] border">
            <CompareRace />
            {data ? <ArchitectureTable data={data} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
