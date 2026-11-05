import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getTheme, initTheme, resetThemeForTests, toggleTheme } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    resetThemeForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it("defaults to dark", () => {
    initTheme();
    expect(getTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggling flips the dark class and persists", () => {
    initTheme();
    toggleTheme();
    expect(getTheme()).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("seqligase-theme")).toBe("light");
  });

  it("restores a stored theme", () => {
    localStorage.setItem("seqligase-theme", "light");
    initTheme();
    expect(getTheme()).toBe("light");
  });

  it("still works when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    initTheme();
    toggleTheme();
    expect(getTheme()).toBe("light");
  });
});
