import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "seqligase-theme";
const listeners = new Set<() => void>();
let theme: Theme = "dark";

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function apply() {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function initTheme() {
  theme = readStored() ?? "dark";
  apply();
}

export function getTheme(): Theme {
  return theme;
}

export function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  apply();
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked. The theme still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function resetThemeForTests() {
  theme = "dark";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  return { theme: useSyncExternalStore(subscribe, getTheme), toggle: toggleTheme };
}
