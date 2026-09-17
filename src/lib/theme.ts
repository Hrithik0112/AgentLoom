import { useCallback, useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

const KEY = "agentloom.theme";
const listeners = new Set<() => void>();

const read = (): Theme => {
  const saved = localStorage.getItem(KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
};

/**
 * `system` removes the attribute entirely rather than writing the resolved value, so the
 * page keeps following the OS if it changes while the tab is open.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme) {
  if (theme === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, theme);
  applyTheme(theme);
  listeners.forEach((fn) => fn());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => "system" as Theme,
  );
  return [theme, useCallback(setTheme, [])] as const;
}

/** Run before first paint so a light-mode visitor never sees a dark flash. */
export const bootTheme = () => applyTheme(read());
