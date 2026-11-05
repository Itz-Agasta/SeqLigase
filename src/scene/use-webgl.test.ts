import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useWebGL, watchContextLoss, webglSupported } from "./use-webgl";

afterEach(() => vi.restoreAllMocks());

describe("WebGL detection", () => {
  it("reports false when no context can be created", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(webglSupported()).toBe(false);
    expect(renderHook(() => useWebGL()).result.current.available).toBe(false);
  });

  it("reports true when a context exists", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as WebGL2RenderingContext,
    );
    expect(webglSupported()).toBe(true);
  });

  it("becomes unavailable when the context is lost", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as WebGL2RenderingContext,
    );
    const { result } = renderHook(() => useWebGL());
    const canvas = document.createElement("canvas");
    act(() => result.current.watch(canvas));
    expect(result.current.available).toBe(true);
    act(() => void canvas.dispatchEvent(new Event("webglcontextlost")));
    expect(result.current.available).toBe(false);
  });

  it("prevents the default action so the browser may restore the context", () => {
    const canvas = document.createElement("canvas");
    const stop = watchContextLoss(canvas, () => undefined);
    const event = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    stop();
  });
});
