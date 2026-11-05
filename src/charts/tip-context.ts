import { createContext, type ReactNode, useContext } from "react";

export const TipContext = createContext<{
  show: (e: { clientX: number; clientY: number }, content: ReactNode) => void;
  hide: () => void;
}>({
  show: () => undefined,
  hide: () => undefined,
});

export const useTip = () => useContext(TipContext);
