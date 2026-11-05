import type { ReactNode } from "react";

export function ChartFrame({
  title,
  note,
  actions,
  children,
  className,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"bg-surface min-w-0 px-[15px] pt-[13px] pb-3 " + (className ?? "")}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-medium">{title}</h3>
          {note ? <p className="text-subtle mt-px text-xs">{note}</p> : null}
        </div>
        {actions ? <div className="flex flex-none items-center gap-1.5">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
