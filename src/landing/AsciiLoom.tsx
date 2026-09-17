import { useEffect, useMemo, useState } from "react";
import { AsciiEffect } from "@/components/ui/ascii-effect";
import { useTheme } from "../lib/theme.ts";

const TOKENS = ["--c-type-llm", "--c-live", "--c-text-faint"];

/**
 * The mark, drawn in characters.
 *
 * A loom is warp threads under tension and weft passes binding them, which is the shape
 * in loom-mark.svg. Rendering it as ASCII is not an arbitrary filter: this is a tool for
 * reading execution in a terminal, and text is the medium it works in. The field reacts
 * to the cursor, so it answers the reader rather than animating at them.
 */
export default function AsciiLoom() {
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
        imageSrc="/loom-mark.svg"
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
