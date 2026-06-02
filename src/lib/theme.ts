import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors (e.g. private mode); the class is still applied.
  }
  applyTheme(theme);
  notify();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// Source of truth is the `.dark` class on <html>, applied pre-hydration by the
// inline script in the root layout. Returning a primitive keeps the snapshot
// referentially stable for useSyncExternalStore.
function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => persistTheme(next), []);
  const toggleTheme = useCallback(
    () => persistTheme(getSnapshot() === "dark" ? "light" : "dark"),
    [],
  );

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}
