import { useEffect, useMemo, useState } from "react";
import { AsciiEffect } from "@/components/ui/ascii-effect";
import { useTheme } from "../lib/theme.ts";

const TOKENS = ["--c-type-llm", "--c-live", "--c-text-faint"];

const OPEN = "/observer.svg";
const SHUT = "/observer-blink.svg";

const LID_MS = 110;
const GAP_MS = 150;
const MIN_REST = 2800;
const MAX_REST = 6200;

/**
 * The watcher, drawn in characters.
 *
 * An agent runs where you cannot see it, and this tool exists to watch it. So the shape
 * is an open eye inside viewfinder brackets, rendered in ASCII because reading execution
 * as text is the medium this tool actually works in. The field tracks the cursor, so the
 * thing on the page that represents observation is itself observing the reader.
 */
export default function AsciiObserver() {
  const [theme] = useTheme();
  const [systemFlip, setSystemFlip] = useState(0);
  const [src, setSrc] = useState(OPEN);

  // The renderer paints to a canvas, and canvas cannot resolve var(). The tokens have to
  // be read off the document as real values, and re-read whenever the theme changes.
  const colors = useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    return TOKENS.map(
      (token) => style.getPropertyValue(token).trim() || "#8794a8",
    );
  }, [theme, systemFlip]);

  // Pinning a theme is not the only way the palette changes: on `system` the OS can flip
  // under us while the tab is open.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemFlip((n) => n + 1);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Blinking is what separates a drawn eye from a logo of an eye. The renderer reloads
  // whenever imageSrc changes and both files are cached after first paint, so a blink
  // costs a decode and nothing else.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setTimeout>;
    const at = (ms: number, fn: () => void) => {
      timer = setTimeout(fn, ms);
    };

    const rest = () =>
      at(MIN_REST + Math.random() * (MAX_REST - MIN_REST), shut);
    const shut = () => {
      setSrc(SHUT);
      // Real eyes double up now and then. Always single reads mechanical.
      at(LID_MS, Math.random() < 0.28 ? double : open);
    };
    const double = () => {
      setSrc(OPEN);
      at(GAP_MS, () => {
        setSrc(SHUT);
        at(LID_MS, open);
      });
    };
    const open = () => {
      setSrc(OPEN);
      rest();
    };

    rest();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-[340px]" aria-hidden>
      <AsciiEffect
        key={colors.join()}
        imageSrc={src}
        alt=""
        variant="flow"
        colors={colors}
        // Defaults cover and crop the mark. Contain keeps the whole eye in frame, and a
        // transparent ground lets the page surface show through instead of a dark square.
        fit="contain"
        backgroundColor="transparent"
        className="h-full w-full"
      />
    </div>
  );
}
