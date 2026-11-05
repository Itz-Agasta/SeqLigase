import type { ReactNode } from "react";

export function Header({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex h-12 flex-none items-center gap-2 border-b px-4">
      <div className="text-subtle flex min-w-0 items-center gap-1.5">{children}</div>
      {actions ? <div className="ml-auto flex gap-1.5">{actions}</div> : null}
    </header>
  );
}
