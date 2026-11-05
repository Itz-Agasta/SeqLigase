import { lazy, Suspense, useRef } from "react";
import { type LabView, useLab } from "@/state/lab-store";
import { MomentOverlay } from "./moment-overlay";
import { ViewDock } from "./view-dock";

const Stage = lazy(() => import("@/scene/stage").then((m) => ({ default: m.Stage })));

const CAPTIONS: Record<LabView, { title: string; note: string }> = {
  original: {
    title: "Original structure",
    note: "RDKit ETKDG conformer, MMFF optimised, seed 1337",
  },
  masked: { title: "Masked input", note: "Dashed atoms are unknown to the model" },
  reconstructed: {
    title: "Reconstructed structure",
    note: "Model output decoded through SELFIES and checked with RDKit",
  },
  overlay: { title: "Overlay", note: "Outer shells are the original" },
};

export function StagePanel() {
  const stageRef = useRef<HTMLDivElement>(null);
  const view = useLab((s) => s.view);
  const inMoment = useLab((s) => s.phase !== "idle");
  const response = useLab((s) => s.response);
  const predicted = view === "reconstructed" || view === "overlay";
  const mismatch = predicted && response ? !response.exact_recovery : false;
  const caption = CAPTIONS[view];
  const note =
    view === "overlay" && response
      ? mismatch
        ? "Outer shells are the original. Amber marks the mismatch."
        : "Outer shells are the original. Every atom matches."
      : caption.note;

  return (
    <div ref={stageRef} className="pointer-events-none relative min-h-0 flex-1">
      <div
        className="bg-surface fixed inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(var(--seq-dot) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className={
          "fixed inset-0 -z-10 bg-[#050507] transition-opacity duration-500 " +
          (inMoment ? "opacity-100" : "opacity-0")
        }
      />
      <div className="pointer-events-auto">
        <Suspense fallback={null}>
          <Stage stageRef={stageRef} />
        </Suspense>
      </div>
      <div data-chrome className="absolute top-3 left-4 z-10">
        <b className="block font-medium">{caption.title}</b>
        <span className="text-subtle text-xs">{note}</span>
      </div>
      <div
        data-chrome
        className="text-muted-foreground absolute top-3 right-4 z-10 flex gap-3.5 text-xs"
      >
        <span className="flex items-center gap-1.5">
          <i className="size-[9px] rounded-full" style={{ background: "var(--seq-atom-c)" }} />
          Context
        </span>
        <span className="flex items-center gap-1.5">
          <i className="border-muted-foreground size-[9px] rounded-full border border-dashed" />
          Masked
        </span>
        <span className="flex items-center gap-1.5">
          <i
            className={
              mismatch ? "bg-warn size-[9px] rounded-full" : "bg-brand size-[9px] rounded-full"
            }
          />
          {mismatch ? "Mismatch" : "Infilled"}
        </span>
      </div>
      <ViewDock />
      <MomentOverlay />
    </div>
  );
}
