import { Monitor, Moon, RotateCcw, Sun, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MODELS } from "../packages/engine/index.ts";
import { clearRuns } from "./lib/persist.ts";
import {
  DEFAULTS,
  resetSettings,
  useSettings,
  type Density,
  type Mono,
  type Sans,
} from "./lib/settings.ts";
import { useTheme, type Theme } from "./lib/theme.ts";
import { useStore } from "./store.ts";
import { button, control, Field } from "./ui.tsx";

const ACCENTS = [
  ["signal", "Signal", "#4ade80"],
  ["amber", "Amber", "#fbbf24"],
  ["cyan", "Cyan", "#22d3ee"],
  ["violet", "Violet", "#a78bfa"],
] as const;

const THEMES: [Theme, typeof Monitor, string][] = [
  ["system", Monitor, "System"],
  ["light", Sun, "Light"],
  ["dark", Moon, "Dark"],
];

const SANS: [Sans, string][] = [
  ["plex", "IBM Plex Sans"],
  ["grotesk", "Bricolage Grotesque"],
  ["inter", "Inter"],
  ["system", "System"],
];

const MONO: [Mono, string][] = [
  ["plex", "IBM Plex Mono"],
  ["jetbrains", "JetBrains Mono"],
  ["system", "System"],
];

const DENSITY: [Density, string][] = [
  ["compact", "Compact"],
  ["default", "Default"],
  ["roomy", "Roomy"],
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-0.5 rounded-lg border border-line bg-surface p-0.5"
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[5px] px-2.5 py-1 text-meta transition-colors ${
            value === v
              ? "bg-elevated text-text"
              : "text-text-dim hover:text-text"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-line px-5 py-5 first:border-t-0">
      <div>
        <h3 className="m-0 text-title font-medium text-text">{title}</h3>
        {note && <p className="mt-1 m-0 text-meta text-text-dim">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [settings, set] = useSettings();
  const [theme, setThemeValue] = useTheme();
  const { apiKey, setApiKey, runs, refreshRuns } = useStore();
  const [cleared, setCleared] = useState(false);

  // showModal is what gives focus trapping, Escape, inert background and a backdrop,
  // none of which is worth reimplementing.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click landing on the dialog itself is a click on the backdrop; the panel
        // inside stops its own clicks from getting here.
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-0 text-text backdrop:bg-black/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="max-h-[80vh] overflow-y-auto">
        <header className="sticky top-0 flex items-center gap-3 border-b border-line bg-panel px-5 py-3.5">
          <h2 className="m-0 text-title font-medium">Preferences</h2>
          <button
            onClick={resetSettings}
            className="ml-auto inline-flex items-center gap-1.5 text-meta text-text-faint transition-colors hover:text-text"
          >
            <RotateCcw size={13} aria-hidden />
            Reset
          </button>
          <button
            onClick={onClose}
            aria-label="Close preferences"
            className="rounded-md p-1 text-text-faint transition-colors hover:bg-raised hover:text-text"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <Group
          title="You"
          note="Local to this browser. Your name is stamped onto workflows you export, so a shared file says who built it."
        >
          <Field label="Name">
            <input
              className={control}
              placeholder="Unattributed"
              value={settings.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
        </Group>

        <Group title="Appearance">
          <Field label="Theme">
            <Segmented
              label="Theme"
              value={theme}
              options={THEMES.map(([v, , text]) => [v, text] as const)}
              onChange={setThemeValue}
            />
          </Field>

          <Field label="Accent" hint="marks the live step and the running path">
            <div role="radiogroup" aria-label="Accent" className="flex gap-2">
              {ACCENTS.map(([value, name, swatch]) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={settings.accent === value}
                  aria-label={name}
                  title={name}
                  onClick={() => set({ accent: value })}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                    settings.accent === value
                      ? "border-text-dim"
                      : "border-line hover:border-line-strong"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ background: swatch }}
                  />
                </button>
              ))}
            </div>
          </Field>

          <Field label="Interface font">
            <Segmented
              label="Interface font"
              value={settings.sans}
              options={SANS}
              onChange={(sans) => set({ sans })}
            />
          </Field>

          <Field label="Code and data font">
            <Segmented
              label="Code and data font"
              value={settings.mono}
              options={MONO}
              onChange={(mono) => set({ mono })}
            />
          </Field>

          <Field label="Density">
            <Segmented
              label="Density"
              value={settings.density}
              options={DENSITY}
              onChange={(density) => set({ density })}
            />
          </Field>
        </Group>

        <Group
          title="Running"
          note="Defaults for new work. A node that already names a model keeps it."
        >
          <Field label="Default model">
            <select
              className={control}
              value={settings.model}
              onChange={(e) => set({ model: e.target.value })}
            >
              {MODELS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Stop a run after"
            hint="steps, the guard against a loop that never exits"
          >
            <input
              type="number"
              min={1}
              max={1000}
              className={`${control} tnum`}
              value={settings.maxSteps}
              onChange={(e) =>
                set({
                  maxSteps: Math.max(
                    1,
                    Number(e.target.value) || DEFAULTS.maxSteps,
                  ),
                })
              }
            />
          </Field>
        </Group>

        <Group
          title="Key and data"
          note="Everything here stays in this browser. The key is sent only to api.anthropic.com."
        >
          <Field
            label="Anthropic API key"
            hint="empty runs against canned responses"
          >
            <input
              type="password"
              placeholder="sk-ant-…"
              className={`${control} font-mono`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3">
            <button
              className={`${button} inline-flex items-center gap-1.5`}
              disabled={runs.length === 0}
              onClick={async () => {
                await clearRuns();
                await refreshRuns();
                setCleared(true);
              }}
            >
              <Trash2 size={13} aria-hidden />
              Delete run history
            </button>
            <span className="text-meta text-text-faint">
              {cleared
                ? "Deleted."
                : runs.length === 0
                  ? "Nothing recorded yet."
                  : `${runs.length} run${runs.length > 1 ? "s" : ""} stored, feeding the Analyze charts.`}
            </span>
          </div>
        </Group>
      </div>
    </dialog>
  );
}
