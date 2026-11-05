import { Header } from "@/app/header";
import { useLab } from "@/state/lab-store";
import { SequenceStrip } from "./sequence-strip";
import { useLabUrl } from "./use-lab-url";

export function RepairLabPage() {
  useLabUrl();
  const record = useLab((s) => s.record);
  return (
    <>
      <Header>
        Repair Lab <span className="text-border-strong">/</span>{" "}
        <b className="text-foreground font-medium">{record?.name}</b>
      </Header>
      <SequenceStrip />
    </>
  );
}
