import { Monitor, Moon, Sun } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "./lib/theme.ts";

export const control =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-ui text-text placeholder:text-text-faint outline-none transition-colors focus:border-pick";

export const button =
  "rounded-md border border-line bg-raised px-3 py-1.5 text-meta text-text transition-colors hover:border-line-strong hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-raised";

export const quietButton =
  "rounded-md px-2.5 py-1.5 text-meta text-text-dim transition-colors hover:bg-raised hover:text-text";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-meta text-text-dim">{label}</span>
        {hint && (
          <span className="font-mono text-micro text-text-faint">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-title font-medium text-text">{children}</h2>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * Width of a panel the user can drag, clamped and remembered. Prompts and JSON need room;
 * the canvas needs to stay usable. The clamp is what keeps both true.
 */
export function useResizablePanel(
  storageKey: string,
  initial: number,
  min: number,
  max: number,
) {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return saved ? clamp(saved, min, max) : initial;
  });
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(clamp(window.innerWidth - e.clientX, min, max));
    };
    const stop = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [min, max]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  // Keep the panel inside the window when the window itself shrinks.
  useEffect(() => {
    const fit = () =>
      setWidth((w) => clamp(w, min, Math.min(max, window.innerWidth - 360)));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [min, max]);

  const onPointerDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 64 : 16;
      if (e.key === "ArrowLeft") setWidth((w) => clamp(w + step, min, max));
      else if (e.key === "ArrowRight")
        setWidth((w) => clamp(w - step, min, max));
      else return;
      e.preventDefault();
    },
    [min, max],
  );

  return { width, onPointerDown, onKeyDown, min, max };
}

export function DragHandle({
  onPointerDown,
  onKeyDown,
  width,
  min,
  max,
}: ReturnType<typeof useResizablePanel>) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group absolute inset-y-0 left-0 z-20 w-2.5 -translate-x-1/2 cursor-col-resize touch-none"
    >
      <div className="mx-auto h-full w-px bg-line transition-colors group-hover:w-0.5 group-hover:bg-pick group-focus-visible:w-0.5 group-focus-visible:bg-pick" />
    </div>
  );
}

/** Three states, not two: pinned light, pinned dark, or whatever the machine says. */
export function ThemeToggle() {
  const [theme, set] = useTheme();
  const options = [
    ["system", Monitor, "Match the system"],
    ["light", Sun, "Light"],
    ["dark", Moon, "Dark"],
  ] as const;

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5"
    >
      {options.map(([value, Icon, label]) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => set(value)}
          className={`rounded-[5px] p-1.5 transition-colors ${
            theme === value
              ? "bg-elevated text-text"
              : "text-text-faint hover:text-text"
          }`}
        >
          <Icon size={14} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/**
 * The mark: an eye inside viewfinder brackets.
 *
 * The same shape the hero renders in ASCII, so the product has one idea rather than two.
 * An agent runs where you cannot see it and this tool watches it, which is what the
 * brackets and the pupil say together. The pupil carries the live color because that is
 * the thing actually being observed.
 */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M2.6 7V2.6H7M17 2.6h4.4V7M21.4 17v4.4H17M7 21.4H2.6V17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M4.9 12Q12 6.7 19.1 12Q12 17.3 4.9 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="var(--color-live)" />
    </svg>
  );
}

/**
 * Holds children back until they scroll into view, then mounts them for good.
 *
 * Some components animate from blank on mount. Mounted above the fold that animation is
 * over before anyone scrolls to it, so the reader only ever sees the finished state.
 * Reserve the space with `minHeight` so nothing jumps when it arrives.
 */
export function WhenSeen({
  children,
  minHeight,
  className,
}: {
  children: ReactNode;
  minHeight?: number | string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSeen(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  return (
    <div ref={ref} className={className} style={{ minHeight }}>
      {seen ? children : null}
    </div>
  );
}

/**
 * A yes/no on a native dialog, so Escape, focus trapping and the backdrop are the
 * platform's job. Never window.confirm: it blocks the whole tab, it cannot be styled,
 * and it reads as a browser warning rather than as part of the app.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-5 text-text backdrop:bg-black/55"
    >
      <h2 className="m-0 text-title font-medium">{title}</h2>
      <p className="mt-2 mb-5 text-ui text-text-dim">{body}</p>
      <div className="flex justify-end gap-2">
        <button className={button} onClick={onCancel}>
          Cancel
        </button>
        <button
          className={`${button} border-halt/40 bg-halt/10 text-halt hover:bg-halt/20`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
