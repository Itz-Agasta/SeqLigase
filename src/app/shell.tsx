import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./sidebar";

export function Shell() {
  return (
    <div className="grid h-full grid-cols-[216px_minmax(0,1fr)]">
      <Sidebar onSearch={() => undefined} />
      <main className="flex min-h-0 min-w-0 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
