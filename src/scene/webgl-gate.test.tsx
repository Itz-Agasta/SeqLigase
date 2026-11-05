import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { compareFinishedOnRun } from "./use-webgl";
import { WebGLGate } from "./webgl-gate";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WebGLGate", () => {
  it("shows the fallback without WebGL", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<WebGLGate fallback={<p>flat</p>}>3d</WebGLGate>);
    expect(screen.getByText("flat")).toBeTruthy();
    expect(screen.queryByText("3d")).toBeNull();
  });
  it("shows its children with WebGL", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as WebGL2RenderingContext,
    );
    render(<WebGLGate fallback={<p>flat</p>}>3d</WebGLGate>);
    expect(screen.getByText("3d")).toBeTruthy();
  });
});

describe("compareFinishedOnRun", () => {
  it("lands every verdict at once without WebGL", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(compareFinishedOnRun(4)).toBe(4);
  });
  it("waits for the viewports with WebGL", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as WebGL2RenderingContext,
    );
    expect(compareFinishedOnRun(4)).toBe(0);
  });
});
