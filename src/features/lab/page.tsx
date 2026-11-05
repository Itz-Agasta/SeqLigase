import { useCallback, useEffect } from "react";
import { Header } from "@/app/header";
import { Button } from "@/components/ui/button";
import { useLab } from "@/state/lab-store";
import { Inspector } from "./inspector";
import { ShareExportActions } from "./share-export-actions";
import { SequenceStrip } from "./sequence-strip";
import { StagePanel } from "./stage-panel";
import { useLabUrl } from "./use-lab-url";

export function RepairLabPage() {
  useLabUrl();
  const record = useLab((s) => s.record);
  const error = useLab((s) => s.error);
  const selection = useLab((s) => s.selection);
  const load = useLab((s) => s.load);
  const reconstruct = useLab((s) => s.reconstruct);
  const run = useCallback(() => void reconstruct(), [reconstruct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  return (
    <>
      <Header actions={<ShareExportActions />}>
        Repair Lab <span className="text-border-strong">/</span>{" "}
        <b className="text-foreground font-medium">{record?.name}</b>
      </Header>
      {error ? (
        <div
          role="alert"
          className="bg-warn-wash text-foreground flex items-center gap-3 border-b px-4 py-2 text-xs"
        >
          {error}
          <Button variant="outline" size="xs" onClick={() => void load(selection)}>
            Retry
          </Button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SequenceStrip />
          <StagePanel />
        </div>
        <Inspector onRun={run} />
      </div>
    </>
  );
}
