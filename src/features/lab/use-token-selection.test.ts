import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { useTokenSelection } from "./use-token-selection";

function setup(start = 4, length = 2) {
  const onChange = vi.fn();
  const { result } = renderHook(() => useTokenSelection({ count: 12, start, length, onChange }));
  return { result, onChange };
}

describe("useTokenSelection", () => {
  it("masks one token on a click", () => {
    const { result, onChange } = setup();
    act(() => {
      result.current.pointerDown(7);
      result.current.pointerUp();
    });
    expect(onChange).toHaveBeenLastCalledWith(7, 1);
  });

  it("clamps a forward drag to three tokens", () => {
    const { result, onChange } = setup();
    act(() => {
      result.current.pointerDown(3);
      result.current.pointerEnter(8);
    });
    expect(onChange).toHaveBeenLastCalledWith(3, 3);
  });

  it("clamps a backward drag to three tokens", () => {
    const { result, onChange } = setup();
    act(() => {
      result.current.pointerDown(8);
      result.current.pointerEnter(3);
    });
    expect(onChange).toHaveBeenLastCalledWith(6, 3);
  });

  it("ignores pointer movement with no drag in progress", () => {
    const { result, onChange } = setup();
    act(() => result.current.pointerEnter(3));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves focus with arrow keys and stays in bounds", () => {
    const { result } = setup();
    act(() => void result.current.keyDown({ key: "ArrowRight", shiftKey: false }, 11));
    expect(result.current.focus).toBe(11);
    act(() => void result.current.keyDown({ key: "ArrowLeft", shiftKey: false }, 11));
    expect(result.current.focus).toBe(10);
  });

  it("masks the focused token with Enter", () => {
    const { result, onChange } = setup();
    act(() => void result.current.keyDown({ key: "Enter", shiftKey: false }, 2));
    expect(onChange).toHaveBeenLastCalledWith(2, 1);
  });

  it("extends with shift-arrow up to three tokens", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      (span: { start: number; length: number }) =>
        useTokenSelection({ count: 12, ...span, onChange }),
      {
        initialProps: { start: 5, length: 1 },
      },
    );
    act(() => void result.current.keyDown({ key: "ArrowRight", shiftKey: true }, 5));
    expect(onChange).toHaveBeenLastCalledWith(5, 2);
    rerender({ start: 5, length: 2 });
    act(() => void result.current.keyDown({ key: "ArrowRight", shiftKey: true }, 6));
    expect(onChange).toHaveBeenLastCalledWith(5, 3);
    rerender({ start: 5, length: 3 });
    onChange.mockClear();
    act(() => void result.current.keyDown({ key: "ArrowRight", shiftKey: true }, 7));
    expect(onChange).toHaveBeenLastCalledWith(5, 3);
  });

  it("restores the old mask when Escape cancels a drag", () => {
    const { result, onChange } = setup(4, 2);
    act(() => {
      result.current.pointerDown(9);
      result.current.pointerEnter(10);
    });
    act(() => void result.current.keyDown({ key: "Escape", shiftKey: false }, 10));
    expect(onChange).toHaveBeenLastCalledWith(4, 2);
    onChange.mockClear();
    act(() => result.current.pointerEnter(11));
    expect(onChange).not.toHaveBeenCalled();
  });
});
