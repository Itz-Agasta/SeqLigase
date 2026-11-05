import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useWide } from "./use-wide";

const stubMedia = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

afterEach(() => vi.unstubAllGlobals());

describe("useWide", () => {
  it("is true on a wide screen", () => {
    stubMedia(true);
    expect(renderHook(() => useWide()).result.current).toBe(true);
  });
  it("is false on a narrower screen", () => {
    stubMedia(false);
    expect(renderHook(() => useWide()).result.current).toBe(false);
  });
});
