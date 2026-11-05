import { type ReactNode, useCallback, useMemo, useState } from "react";
import { TipContext } from "./tip-context";

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

export function TipRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="text-muted-foreground flex justify-between gap-3.5">
      <span>{label}</span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  );
}

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback(
    (e: { clientX: number; clientY: number }, content: ReactNode) =>
      setTip({ x: e.clientX, y: e.clientY, content }),
    [],
  );
  const hide = useCallback(() => setTip(null), []);
  const value = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <TipContext.Provider value={value}>
      {children}
      {tip ? (
        <div
          role="status"
          className="bg-raise border-border-strong pointer-events-none fixed z-50 max-w-[260px] rounded-[7px] border px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(tip.x + 14, window.innerWidth - 270),
            top: Math.max(8, tip.y - 12),
            transform: "translateY(-100%)",
          }}
        >
          {tip.content}
        </div>
      ) : null}
    </TipContext.Provider>
  );
}
