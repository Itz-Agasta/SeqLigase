import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useLab } from "@/state/lab-store";
import { CommandMenu } from "./command-menu";
import { Sidebar } from "./sidebar";

export function Shell() {
  const inMoment = useLab((s) => s.phase !== "idle");
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <div
        data-moment={inMoment || undefined}
        className="grid h-full grid-cols-[216px_minmax(0,1fr)]"
      >
        <Sidebar onSearch={() => setSearchOpen(true)} />
        <main className="flex min-h-0 min-w-0 flex-col">
          <Outlet />
        </main>
      </div>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster position="bottom-right" />
    </>
  );
}
