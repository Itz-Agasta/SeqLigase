import { Link } from "@tanstack/react-router";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { modelColor } from "@/charts/chart-math";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { client } from "@/engine/client";
import type { CatalogEntry } from "@/engine/types";
import { cn } from "@/lib/utils";
import { compareFinishedOnRun } from "@/scene/use-webgl";
import { WebGLGate } from "@/scene/webgl-gate";
import { useLab } from "@/state/lab-store";
import { DEFAULT_SELECTION } from "@/state/url-state";
import { summariseCompare } from "./summarise";

const CompareViewport = lazy(() =>
  import("./compare-viewport").then((m) => ({ default: m.CompareViewport })),
);

export function CompareRace() {
  const record = useLab((s) => s.record);
  const selection = useLab((s) => s.selection);
  const setMolecule = useLab((s) => s.setMolecule);
  const load = useLab((s) => s.load);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [runId, setRunId] = useState(0);
  const [finished, setFinished] = useState(0);

  useEffect(() => {
    void client.catalog().then(setCatalog);
    if (!useLab.getState().record) void load(DEFAULT_SELECTION);
  }, [load]);

  const rows = useMemo(
    () => (record ? summariseCompare(record, selection.start, selection.length) : []),
    [record, selection.start, selection.length],
  );
  const running = runId > 0 && finished < rows.length;
  const done = runId > 0 && finished >= rows.length;

  return (
    <section className="col-span-12">
      <div className="bg-surface flex flex-wrap items-center gap-3 px-[15px] py-3">
        <div className="mr-auto">
          <h3 className="text-[13px] font-medium">Compare models</h3>
          <p className="text-subtle mt-px text-xs">
            {record ? (
              <>
                {record.name}, masking{" "}
                {selection.length === 1
                  ? `token ${selection.start}`
                  : `tokens ${selection.start} to ${selection.start + selection.length - 1}`}
                .{" "}
                <Link to="/" className="underline underline-offset-2">
                  Change the mask in Repair Lab
                </Link>
                .
              </>
            ) : (
              "Loading…"
            )}
          </p>
        </div>
        <div className="w-[210px]">
          <Select
            value={selection.moleculeId}
            disabled={running}
            onValueChange={(id) => {
              setRunId(0);
              setFinished(0);
              void setMolecule(id);
            }}
          >
            <SelectTrigger
              aria-label="Molecule"
              size="sm"
              className="bg-raise h-[29px]! w-full text-[13px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={running || rows.length === 0}
          className="h-[29px] text-[13px] font-medium"
          onClick={() => {
            setFinished(compareFinishedOnRun(rows.length));
            setRunId((n) => n + 1);
          }}
        >
          {running ? "Comparing…" : done ? "Compare again" : "Run comparison"}
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-px border-t">
        {record
          ? rows.map((row) => (
              <div key={row.model} className="bg-surface min-w-0">
                <div className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium">
                  <i
                    className="size-2 rounded-full"
                    style={{ background: modelColor(row.model) }}
                  />
                  {row.model}
                </div>
                <div className="relative h-[280px] bg-[#050507] min-[1600px]:h-[420px]">
                  <WebGLGate
                    fallback={
                      <p className="text-muted-foreground grid h-full place-items-center p-4 text-center text-xs">
                        3D view isn’t available in this browser.
                      </p>
                    }
                  >
                    <Suspense fallback={null}>
                      <CompareViewport
                        key={`${row.model}:${record.id}:${selection.start}:${selection.length}`}
                        label={`${row.model} repairing ${record.name}`}
                        record={record}
                        response={row.response}
                        runId={runId}
                        onDone={() => setFinished((n) => n + 1)}
                      />
                    </Suspense>
                  </WebGLGate>
                </div>
                <div
                  className={cn(
                    "min-h-[92px] px-3 py-2.5 text-xs transition-opacity duration-300",
                    done ? "opacity-100" : "opacity-40",
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {row.tokens.map((t) => (
                      <span
                        key={t.position}
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[11.5px]",
                          !done
                            ? "border-border-strong text-subtle border-dashed"
                            : t.right
                              ? "border-brand bg-brand-wash text-brand-text"
                              : "border-warn bg-warn-wash text-warn",
                        )}
                      >
                        {done ? t.token : "[MASK]"}
                      </span>
                    ))}
                  </div>
                  {done ? (
                    <>
                      <div className="flex items-start gap-1.5 font-medium">
                        {row.verdict.tone === "good" ? (
                          <CircleCheck
                            className="text-good mt-px size-3.5 flex-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <TriangleAlert
                            className="text-warn mt-px size-3.5 flex-none"
                            aria-hidden="true"
                          />
                        )}
                        {row.verdict.tone === "good"
                          ? "Exact recovery"
                          : row.response.valid
                            ? "Partial recovery"
                            : "Invalid"}
                      </div>
                      <div className="text-muted-foreground mt-1 flex justify-between font-mono text-[11.5px]">
                        <span>
                          {row.correct} of {row.total} tokens
                        </span>
                        <span>Tanimoto {row.tanimoto.toFixed(3)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-subtle">{running ? "Reconstructing…" : "Ready to run"}</p>
                  )}
                </div>
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
