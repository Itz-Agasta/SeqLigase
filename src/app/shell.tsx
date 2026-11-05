import { Outlet } from "@tanstack/react-router";
import { useLab } from "@/state/lab-store";
import { Sidebar } from "./sidebar";

export function Shell() {
  const inMoment = useLab((s) => s.phase !== "idle");
  return (
    <div
      data-moment={inMoment || undefined}
      className="grid h-full grid-cols-[216px_minmax(0,1fr)]"
    >
      <Sidebar onSearch={() => undefined} />
      <main className="flex min-h-0 min-w-0 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
