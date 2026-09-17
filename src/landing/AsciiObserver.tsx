import { useEffect, useMemo, useState } from "react";
import { AsciiEffect } from "@/components/ui/ascii-effect";
import { useTheme } from "../lib/theme.ts";

const TOKENS = ["--c-type-llm", "--c-live", "--c-text-faint"];

/**
 * The watcher, drawn in characters.
 *
 * An agent runs where you cannot see it, and this tool exists to watch it. So the shape
 * is an open eye, and it is rendered in ASCII because reading execution as text is the
 * medium this tool actually works in. The field tracks the cursor, so the thing on the
 * page that represents observation is itself observing the reader.
 */
export default function AsciiObserver() {
  const [theme] = useTheme();
  const [systemFlip, setSystemFlip] = useState(0);

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

  return (
    <div className="relative aspect-square w-full max-w-[340px]" aria-hidden>
      <AsciiEffect
        key={colors.join()}
        imageSrc="/observer.svg"
        alt=""
        variant="flow"
        colors={colors}
        // Defaults cover and crop the mark. Contain keeps the whole weave in frame, and a
        // transparent ground lets the page surface show through instead of a dark square.
        fit="contain"
        backgroundColor="transparent"
        className="h-full w-full"
      />
    </div>
  );
}
