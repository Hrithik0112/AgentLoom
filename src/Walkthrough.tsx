import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "./store.ts";
import { button } from "./ui.tsx";

const SEEN_KEY = "agentloom.tour";

export const hasSeenTour = () => localStorage.getItem(SEEN_KEY) === "done";
const markSeen = () => localStorage.setItem(SEEN_KEY, "done");

type Step = {
  /** A data-tour attribute value, or nothing for a step that sits in the middle. */
  target?: string;
  title: string;
  body: string;
  place?: "top" | "bottom" | "left" | "right";
  /** Put the app into the state this step is about, before we look for the target. */
  before?: () => void | Promise<void>;
};

const PAD = 8;
const GAP = 14;
const CARD_W = 340;

/**
 * The steps drive the app as well as describe it. A tour that only draws boxes over a
 * static screen has to lie about a tool whose whole point is that it runs, so this one
 * switches modes and actually executes the workflow in front of you.
 */
const store = useStore.getState;

const STEPS: Step[] = [
  {
    title: "This is a debugger, not a canvas",
    body: "Agent workflows fail somewhere in the middle and logs will not tell you where. Two minutes and you will know how to find it.",
  },
  {
    target: "rail",
    place: "right",
    title: "Seven kinds of node",
    body: "A model call, a tool, a branch, a loop, a gate that waits for a person, and the two ends. That is the whole vocabulary.",
    before: () => store().setMode("build"),
  },
  {
    target: "canvas",
    place: "top",
    title: "The workflow itself",
    body: "Each card shows what it does and what it has actually cost you, measured from real runs rather than estimated.",
  },
  {
    target: "inspector",
    place: "left",
    title: "What a node reads and writes",
    body: "Select any node to edit its prompt or condition. The panel tells you which state keys it reads and which it writes, derived from the config so it cannot drift.",
    before: () => {
      const first = store().nodes.find((n) => n.data.type === "llm");
      if (first) store().select(first.id);
    },
  },
  {
    target: "transport",
    place: "left",
    title: "Run it a step at a time",
    body: "Run goes to the end, Step takes exactly one node. Watch the next part: this is a real execution, against canned responses because you have not set a key.",
    before: () => store().setMode("debug"),
  },
  {
    target: "inspector",
    place: "left",
    title: "Every step, and what it changed",
    body: "That run just happened. Click any step to see the state diff, and open Prompt sent to read exactly what went to the model after interpolation.",
    before: async () => {
      store().setMode("debug");
      if (store().steps.length === 0) await store().start();
    },
  },
  {
    target: "breakpoint",
    place: "bottom",
    title: "Break before a node",
    body: "Click the dot on any card to pause the run before it reaches that node. Then edit the state by hand and carry on, or replay from an earlier step without re-paying for the ones before it.",
  },
  {
    target: "modes",
    place: "bottom",
    title: "Across many runs",
    body: "Analyze shows which paths requests actually take, which nodes burn the time and money, and how two versions compare on the same scenarios.",
  },
  {
    target: "settings",
    place: "bottom",
    title: "Yours to set up",
    body: "Your API key, the accent, fonts, density and the step cap live here. So does this walkthrough, any time you want it again.",
  },
];

/** Targets can appear a frame or two after the state change that reveals them. */
function findTarget(name: string, tries = 40): Promise<Element | null> {
  return new Promise((resolve) => {
    const look = (left: number) => {
      const el = document.querySelector(`[data-tour="${name}"]`);
      if (el || left === 0) return resolve(el);
      requestAnimationFrame(() => look(left - 1));
    };
    look(tries);
  });
}

export function Walkthrough({ onDone }: { onDone: () => void }) {
  const all = STEPS;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const step = all[index];
  const last = index === all.length - 1;

  const finish = useCallback(() => {
    markSeen();
    onDone();
  }, [onDone]);

  // Each step sets up the app, then waits for the thing it is pointing at.
  useEffect(() => {
    let alive = true;
    setReady(false);
    setRect(null);
    (async () => {
      await step.before?.();
      if (!alive) return;
      if (!step.target) {
        setReady(true);
        return;
      }
      const el = await findTarget(step.target);
      if (!alive) return;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setRect(el?.getBoundingClientRect() ?? null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [index, step]);

  // Keep the hole on the target if the window moves underneath it.
  useLayoutEffect(() => {
    if (!step.target) return;
    const sync = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter")
        last ? finish() : setIndex((i) => i + 1);
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, finish]);

  if (!ready) return null;

  // No target means a card in the middle of the screen.
  const card = rect
    ? placeCard(rect, step.place ?? "bottom")
    : {
        top: window.innerHeight / 2 - 90,
        left: window.innerWidth / 2 - CARD_W / 2,
      };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Walkthrough">
      {rect ? (
        // One element with an enormous spread shadow dims everything except the hole,
        // which beats compositing four separate panels around the target.
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-live transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(3, 6, 12, 0.72)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(3,6,12,0.72)]" />
      )}

      <div
        className="absolute w-[340px] rounded-xl border border-line bg-panel p-4 shadow-2xl transition-all duration-200"
        style={{ top: card.top, left: card.left }}
      >
        <div className="tnum mb-2 font-mono text-micro text-text-faint">
          {index + 1} of {all.length}
        </div>
        <h2 className="m-0 text-title font-medium text-text">{step.title}</h2>
        <p className="mt-2 mb-4 text-ui leading-relaxed text-text-dim">
          {step.body}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={finish}
            className="text-meta text-text-faint transition-colors hover:text-text"
          >
            Skip
          </button>
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button className={button} onClick={() => setIndex((i) => i - 1)}>
                Back
              </button>
            )}
            <button
              className={`${button} border-live/40 bg-live/12 text-live hover:bg-live/20`}
              onClick={() => (last ? finish() : setIndex((i) => i + 1))}
            >
              {last ? "Start building" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Put the card beside the hole, then pull it back inside the viewport. */
function placeCard(rect: DOMRect, place: NonNullable<Step["place"]>) {
  const H = 210;
  let top = rect.bottom + GAP;
  let left = rect.left;

  if (place === "top") top = rect.top - H - GAP;
  if (place === "left") {
    top = rect.top;
    left = rect.left - CARD_W - GAP;
  }
  if (place === "right") {
    top = rect.top;
    left = rect.right + GAP;
  }

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  return {
    top: clamp(top, 12, window.innerHeight - H - 12),
    left: clamp(left, 12, window.innerWidth - CARD_W - 12),
  };
}
