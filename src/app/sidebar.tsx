import { Link } from "@tanstack/react-router";
import {
  Activity,
  Boxes,
  ChartSpline,
  Database,
  FlaskConical,
  Search,
  SunMoon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "@/engine/client";
import type { ExperimentsData } from "@/engine/types";
import { useLab } from "@/state/lab-store";
import { useTheme } from "./theme";

const NAV = [
  { to: "/", label: "Repair Lab", icon: FlaskConical },
  { to: "/runs", label: "Runs", icon: Activity },
  { to: "/experiments", label: "Experiments", icon: ChartSpline },
  { to: "/models", label: "Models", icon: Boxes },
  { to: "/datasets", label: "Datasets", icon: Database },
] as const;

export function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M7 3H3.6v14H7M13 3h3.4v14H13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.1" className="fill-brand-text" />
    </svg>
  );
}

export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const { toggle } = useTheme();
  const model = useLab((s) => s.selection.model);
  const [architectures, setArchitectures] = useState<ExperimentsData["architectures"]>([]);
  const checkpoint = architectures.find((a) => a.id === model)?.checkpoint;

  useEffect(() => {
    let live = true;
    client.experiments().then(
      (d) => live && setArchitectures(d.architectures),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  const inMoment = useLab((s) => s.phase !== "idle");
  return (
    <aside
      inert={inMoment}
      data-chrome
      className="bg-sidebar relative z-10 flex min-h-0 flex-col border-r px-2 py-2.5"
    >
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5 text-sm font-semibold tracking-tight">
        <BrandMark />
        SeqLigase
      </div>
      <button
        type="button"
        onClick={onSearch}
        className="bg-surface text-subtle hover:border-border-strong mb-3 flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 transition-colors"
      >
        <Search className="size-[15px]" aria-hidden="true" />
        Search
        <kbd className="ml-auto font-mono text-[11px]">⌘K</kbd>
      </button>
      <nav aria-label="Main" className="flex flex-col gap-px">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
            activeOptions={{ exact: to === "/", includeSearch: false }}
            activeProps={{ className: "bg-accent text-foreground font-medium" }}
          >
            <Icon className="size-[15px]" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={toggle}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
        >
          <SunMoon className="size-[15px]" aria-hidden="true" />
          Switch theme
        </button>
        <div className="text-muted-foreground border-t px-2 py-2.5 text-xs">
          <div className="text-foreground flex items-center gap-2 font-medium">
            <span className="bg-good size-[7px] rounded-full" aria-hidden="true" />
            Model server ready
          </div>
          <span className="font-mono text-[11.5px]">{checkpoint}</span>
        </div>
      </div>
    </aside>
  );
}
