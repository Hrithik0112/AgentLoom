import { useSyncExternalStore } from "react";
import { DEFAULT_MODEL } from "../../packages/engine/index.ts";

export type Accent = "signal" | "amber" | "cyan" | "violet";
export type Sans = "plex" | "grotesk" | "inter" | "system";
export type Mono = "plex" | "jetbrains" | "system";
export type Density = "compact" | "default" | "roomy";

export type Settings = {
  /** Stamped onto exported workflows. Nothing else reads it. */
  name: string;
  accent: Accent;
  sans: Sans;
  mono: Mono;
  density: Density;
  /** Default model for newly added model-call nodes. */
  model: string;
  /** Default ceiling on steps per run, the guard against a cycle that never exits. */
  maxSteps: number;
};

export const DEFAULTS: Settings = {
  name: "",
  accent: "signal",
  sans: "plex",
  mono: "plex",
  density: "default",
  model: DEFAULT_MODEL,
  maxSteps: 100,
};

const KEY = "agentloom.settings";
const listeners = new Set<() => void>();

let cache: Settings = DEFAULTS;
let loaded = false;

function read(): Settings {
  if (loaded) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    cache = DEFAULTS;
  }
  loaded = true;
  return cache;
}

/**
 * Bricolage and Plex already ship on the page. Inter and JetBrains only get fetched if
 * somebody actually picks them, so an unused choice costs nothing.
 */
const WEB_FONTS: Partial<Record<Sans | Mono, string>> = {
  inter:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
  jetbrains:
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap",
};

function ensureFont(choice: Sans | Mono) {
  const href = WEB_FONTS[choice];
  if (!href || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** Every preference is one attribute on the root element; the stylesheet does the rest. */
export function applySettings(next: Settings) {
  const root = document.documentElement;
  const attrs: Record<string, string> = {
    "data-accent": next.accent,
    "data-sans": next.sans,
    "data-mono": next.mono,
    "data-density": next.density,
  };
  for (const [attr, value] of Object.entries(attrs)) {
    // The default value has no rule attached, so leaving the attribute off keeps the
    // inspector readable and makes "is this customised" obvious.
    const isDefault =
      value === DEFAULTS[attr.replace("data-", "") as keyof Settings];
    if (isDefault) root.removeAttribute(attr);
    else root.setAttribute(attr, value);
  }
  ensureFont(next.sans);
  ensureFont(next.mono);
}

export function setSettings(patch: Partial<Settings>) {
  cache = { ...read(), ...patch };
  loaded = true;
  localStorage.setItem(KEY, JSON.stringify(cache));
  applySettings(cache);
  listeners.forEach((fn) => fn());
}

export function resetSettings() {
  cache = DEFAULTS;
  loaded = true;
  localStorage.removeItem(KEY);
  applySettings(cache);
  listeners.forEach((fn) => fn());
}

/** Current settings outside React, for the store and the engine wiring. */
export const readSettings = read;

export function useSettings() {
  const settings = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => DEFAULTS,
  );
  return [settings, setSettings] as const;
}

/** Run before first paint, alongside the theme, so nothing restyles after load. */
export const bootSettings = () => applySettings(read());
