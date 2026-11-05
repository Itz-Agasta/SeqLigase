import { cn } from "@/lib/utils";
import { type LabView, useLab } from "@/state/lab-store";

const VIEWS: { id: LabView; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "masked", label: "Masked" },
  { id: "reconstructed", label: "Reconstructed" },
  { id: "overlay", label: "Overlay" },
];

const BTN =
  "text-muted-foreground hover:bg-secondary hover:text-foreground flex h-7 items-center rounded-md px-2.5 text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
const ON = "bg-accent text-foreground font-medium";

export function ViewDock() {
  const view = useLab((s) => s.view);
  const status = useLab((s) => s.status);
  const showHydrogens = useLab((s) => s.showHydrogens);
  const spin = useLab((s) => s.spin);
  const setView = useLab((s) => s.setView);
  const toggle = useLab((s) => s.toggleDisplay);
  const camera = useLab((s) => s.commandCamera);
  return (
    <div
      data-chrome
      role="toolbar"
      aria-label="3D view"
      className="bg-raise border-border-strong pointer-events-auto absolute bottom-3.5 z-10 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[9px] border p-[3px] shadow-lg"
    >
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={view === v.id}
          disabled={status !== "done" && (v.id === "reconstructed" || v.id === "overlay")}
          onClick={() => setView(v.id)}
          className={cn(BTN, view === v.id && ON)}
        >
          {v.label}
        </button>
      ))}
      <span className="bg-border-strong mx-1 h-4 w-px" />
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out (-)"
        onClick={() => camera("out")}
        className={BTN}
      >
        −
      </button>
      <button
        type="button"
        title="Fit the molecule (0)"
        onClick={() => camera("fit")}
        className={BTN}
      >
        Fit
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in (+)"
        onClick={() => camera("in")}
        className={BTN}
      >
        +
      </button>
      <span className="bg-border-strong mx-1 h-4 w-px" />
      <button
        type="button"
        aria-pressed={showHydrogens}
        title="Show hydrogens"
        onClick={() => toggle("showHydrogens")}
        className={cn(BTN, showHydrogens && ON)}
      >
        H
      </button>
      <button
        type="button"
        aria-pressed={spin}
        onClick={() => toggle("spin")}
        className={cn(BTN, spin && ON)}
      >
        {spin ? "Pause" : "Rotate"}
      </button>
    </div>
  );
}
