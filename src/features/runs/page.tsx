import { Link, useNavigate } from "@tanstack/react-router";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/app/header";
import { Button } from "@/components/ui/button";
import { useLab } from "@/state/lab-store";
import { runLog, type RunEntry } from "./run-log";

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  month: "short",
  day: "numeric",
});
const maskLabel = (r: RunEntry) =>
  r.length === 1 ? `Token ${r.start}` : `Tokens ${r.start} to ${r.start + r.length - 1}`;

export function RunsPage() {
  const [runs, setRuns] = useState(() => runLog.list());
  const navigate = useNavigate();
  const openRun = useLab((s) => s.openRun);
  const open = (r: RunEntry) => {
    void openRun({
      moleculeId: r.moleculeId,
      model: r.model,
      start: r.start,
      length: r.length,
      seed: r.seed,
    }).then(() => navigate({ to: "/" }));
  };
  return (
    <>
      <Header
        actions={
          runs.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const previous = runs;
                runLog.clear();
                setRuns([]);
                toast("History cleared", {
                  action: {
                    label: "Undo",
                    onClick: () => {
                      runLog.replace(previous);
                      setRuns(previous);
                    },
                  },
                });
              }}
            >
              Clear history
            </Button>
          ) : null
        }
      >
        <b className="text-foreground font-medium">Runs</b>
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1240px] px-5 pt-[18px] pb-11">
          <h1 className="text-xl font-semibold tracking-tight">Runs</h1>
          <p className="text-muted-foreground mb-3.5">
            Every reconstruction from this browser, newest first. Open one to see it in the Repair
            Lab.
          </p>
          {runs.length === 0 ? (
            <div className="rounded-[10px] border border-dashed px-6 py-12 text-center">
              <p className="mb-3 font-medium">No runs yet</p>
              <Button asChild size="sm">
                <Link to="/">Open Repair Lab</Link>
              </Button>
            </div>
          ) : (
            <div className="bg-surface overflow-hidden rounded-[10px] border">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-subtle text-left">
                    <th className="border-b px-3.5 py-2 font-normal">Time</th>
                    <th className="border-b px-3.5 py-2 font-normal">Molecule</th>
                    <th className="border-b px-3.5 py-2 font-normal">Model</th>
                    <th className="border-b px-3.5 py-2 font-normal">Mask</th>
                    <th className="border-b px-3.5 py-2 font-normal">Result</th>
                    <th className="border-b px-3.5 py-2 text-right font-normal">Tanimoto</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-secondary cursor-pointer transition-colors [&:last-child>td]:border-0"
                      onClick={() => open(r)}
                    >
                      <td className="text-muted-foreground border-b px-3.5 py-2 font-mono text-xs">
                        {TIME.format(r.at)}
                      </td>
                      <td className="border-b px-3.5 py-2 font-medium">
                        <button type="button" className="hover:underline" onClick={() => open(r)}>
                          {r.name}
                        </button>
                      </td>
                      <td className="text-muted-foreground border-b px-3.5 py-2">{r.model}</td>
                      <td className="text-muted-foreground border-b px-3.5 py-2">{maskLabel(r)}</td>
                      <td className="border-b px-3.5 py-2">
                        <span className="flex items-center gap-1.5">
                          {r.exact ? (
                            <CircleCheck className="text-good size-3.5" aria-hidden="true" />
                          ) : (
                            <TriangleAlert className="text-warn size-3.5" aria-hidden="true" />
                          )}
                          {r.exact ? "Exact" : r.valid ? "Partial" : "Invalid"}
                        </span>
                      </td>
                      <td className="border-b px-3.5 py-2 text-right font-mono text-xs">
                        {r.tanimoto.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
