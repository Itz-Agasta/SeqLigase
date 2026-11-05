import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLab } from "@/state/lab-store";
import { downloadBlob, exportFilename, exportRun, shareUrl } from "./share-export";

export function ShareExportActions() {
  const selection = useLab((s) => s.selection);
  const response = useLab((s) => s.response);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[12.5px]"
        onClick={() => {
          const url = shareUrl(selection);
          void navigator.clipboard.writeText(url).then(
            () => toast("Link copied"),
            () => toast("Couldn't reach the clipboard", { description: url }),
          );
        }}
      >
        Share
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[12.5px]"
        disabled={!response}
        title={response ? undefined : "Run the model first"}
        onClick={() => {
          if (!response) return;
          downloadBlob(
            exportRun(response),
            exportFilename(
              selection.moleculeId,
              selection.model,
              selection.start,
              selection.length,
            ),
          );
          toast("Run exported");
        }}
      >
        Export
      </Button>
    </>
  );
}
