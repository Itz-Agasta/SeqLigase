import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/** Measures available width only, so a chart can set its own height. */
export function ChartWidth({ children }: { children: (props: { width: number }) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{width > 0 ? children({ width }) : null}</div>;
}
