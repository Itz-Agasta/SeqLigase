import { useCallback, useRef, useState } from "react";

const MAX_SPAN = 3;

interface Options {
  count: number;
  start: number;
  length: number;
  onChange(start: number, length: number): void;
}

export interface KeyLike {
  key: string;
  shiftKey: boolean;
}

export function spanBetween(anchor: number, to: number) {
  const length = Math.min(Math.abs(to - anchor) + 1, MAX_SPAN);
  return { start: to >= anchor ? anchor : anchor - length + 1, length };
}

export function useTokenSelection({ count, start, length, onChange }: Options) {
  const [focus, setFocus] = useState(start);
  const drag = useRef<{ anchor: number; before: [number, number] } | null>(null);

  const pointerDown = useCallback(
    (i: number) => {
      drag.current = { anchor: i, before: [start, length] };
      onChange(i, 1);
      setFocus(i);
    },
    [start, length, onChange],
  );

  const pointerEnter = useCallback(
    (i: number) => {
      if (!drag.current) return;
      const span = spanBetween(drag.current.anchor, i);
      onChange(span.start, span.length);
    },
    [onChange],
  );

  const pointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  const keyDown = useCallback(
    (e: KeyLike, i: number) => {
      if (e.key === "Escape") {
        if (drag.current) onChange(...drag.current.before);
        drag.current = null;
        return false;
      }
      if (e.key === "Enter" || e.key === " ") {
        onChange(i, 1);
        return true;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return false;
      const step = e.key === "ArrowRight" ? 1 : -1;
      const next = Math.max(0, Math.min(count - 1, i + step));
      if (e.shiftKey) {
        // The end of the mask nearest the key's direction moves, anchored at the other end.
        const anchor = step > 0 ? start : start + length - 1;
        const span = spanBetween(anchor, step > 0 ? start + length : start - 1);
        if (span.start >= 0 && span.start + span.length <= count) onChange(span.start, span.length);
      }
      setFocus(next);
      return true;
    },
    [count, start, length, onChange],
  );

  return { focus, pointerDown, pointerEnter, pointerUp, keyDown };
}
