import { useCallback, useEffect, useRef, useState } from "react";

export const control =
  "w-full rounded-md border border-line bg-ink-900 px-2.5 py-1.5 text-ui text-text placeholder:text-text-faint outline-none transition-colors focus:border-pick";

export const button =
  "rounded-md border border-line bg-ink-700 px-3 py-1.5 text-meta text-text transition-colors hover:border-line-bright hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-ink-700";

export const quietButton =
  "rounded-md px-2.5 py-1.5 text-meta text-text-dim transition-colors hover:bg-ink-700 hover:text-text";

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
