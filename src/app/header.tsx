import type { ReactNode } from "react";

export function Header({
  title,
  parent,
  note,
  actions,
}: {
  title?: string;
  parent?: string;
  note?: string;
  actions?: ReactNode;
}) {
  return (
    <header
      data-chrome
      className="bg-background relative z-10 flex h-12 flex-none items-center gap-3 border-b px-4"
    >
      <div className="flex min-w-0 items-baseline gap-1.5">
        {parent ? (
          <>
            <span className="text-subtle whitespace-nowrap">{parent}</span>
            <span className="text-border-strong" aria-hidden="true">
              /
            </span>
          </>
        ) : null}
        <h1 className="text-foreground text-[13px] font-medium whitespace-nowrap">{title}</h1>
        {note ? <p className="text-subtle ml-1.5 truncate text-xs">{note}</p> : null}
      </div>
      {actions ? (
        <div className="ml-auto flex flex-none items-center gap-1.5">{actions}</div>
      ) : null}
    </header>
  );
}
