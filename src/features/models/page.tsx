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
      <Header>
        <b className="text-foreground font-medium">Models</b>
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1240px] px-5 pt-[18px] pb-11">
          <h1 className="mb-3.5 text-xl font-semibold tracking-tight">Models</h1>
          <div className="bg-border grid grid-cols-12 gap-px overflow-hidden rounded-[10px] border">
            <CompareRace />
            {data ? <ArchitectureTable data={data} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
