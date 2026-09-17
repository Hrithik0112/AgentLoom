import {
  Download,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnalyzePanel } from "./analyze/AnalyzePanel.tsx";
import { Canvas } from "./canvas/Canvas.tsx";
import { ConfigPanel } from "./canvas/ConfigPanel.tsx";
import { TypeIcon } from "./canvas/LoomNodeView.tsx";
import { DebugPanel } from "./debug/DebugPanel.tsx";
import { EXAMPLES } from "./examples.ts";
import { NODE_TYPES, type LoomDoc } from "./lib/graph.ts";
import { download } from "./lib/persist.ts";
import { useStore, type Mode, type RunStatus } from "./store.ts";
import { control, DragHandle, quietButton, useResizablePanel } from "./ui.tsx";

const MODES: Mode[] = ["build", "debug", "analyze"];

/** Capitalizing the type slug gives "Llm", so the rail spells things out itself. */
const NODE_LABEL: Record<string, string> = {
  input: "Input",
  llm: "Model call",
  tool: "Tool",
  condition: "Branch",
  loop: "Loop",
  approval: "Human gate",
  output: "Output",
};

/** Collapsed, a column of identical dots says nothing, so each keeps a short code. */
const NODE_CODE: Record<string, string> = {
  input: "in",
  llm: "llm",
  tool: "fn",
  condition: "if",
  loop: "for",
  approval: "ask",
  output: "out",
};

const STATUS_COLOR: Record<RunStatus, string> = {
  idle: "bg-text-faint",
  running: "bg-amber-400",
  paused: "bg-pick",
  "awaiting-approval": "bg-halt",
  done: "bg-live",
  error: "bg-halt",
  halted: "bg-halt",
};

function Mark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      className="shrink-0"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M3 2v14M9 2v14M15 2v14" opacity="0.45" />
        <path d="M1.5 6.5h15M1.5 11.5h15" />
      </g>
    </svg>
  );
}

export default function App() {
  const {
    mode,
    setMode,
    name,
    rename,
    nodes,
    edges,
    addNode,
    apiKey,
    setApiKey,
    loadDocument,
    setInput,
    refreshRuns,
    status,
    steps,
  } = useStore();

  const fileInput = useRef<HTMLInputElement>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [keyOpen, setKeyOpen] = useState(false);
  const panel = useResizablePanel("agentloom.panelWidth", 400, 320, 760);

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  return (
    <div className="flex h-full flex-col bg-ink-900">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-ink-800 px-4">
        <div className="flex items-center gap-2.5 text-text">
          <Mark />
          <span className="text-title font-semibold tracking-tight">
            agentloom
          </span>
        </div>

        <div className="h-5 w-px bg-line" />

        <input
          aria-label="Workflow name"
          className="w-52 rounded-md border border-transparent bg-transparent px-2 py-1 text-ui font-medium text-text transition-colors hover:border-line focus:border-pick focus:outline-none"
          value={name}
          onChange={(e) => rename(e.target.value)}
        />

        <nav
          className="flex gap-0.5 rounded-lg border border-line bg-ink-900 p-0.5"
          aria-label="Mode"
        >
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-current={mode === m}
              className={`rounded-[5px] px-3 py-1 text-meta capitalize transition-colors ${
                mode === m
                  ? "bg-ink-600 text-text"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {m}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <select
            aria-label="Load an example workflow"
            className="rounded-md border border-line bg-ink-700 px-2.5 py-1.5 text-meta text-text-dim transition-colors hover:border-line-bright hover:text-text"
            value=""
            onChange={(e) => {
              const example = EXAMPLES.find((x) => x.name === e.target.value);
              if (!example) return;
              loadDocument(example.doc);
              setInput(example.input);
            }}
          >
            <option value="">Examples</option>
            {EXAMPLES.map((x) => (
              <option key={x.name}>{x.name}</option>
            ))}
          </select>

          <button
            className={`${quietButton} inline-flex items-center gap-1.5`}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={13} aria-hidden />
            Import
          </button>
          <button
            className={`${quietButton} inline-flex items-center gap-1.5`}
            onClick={() =>
              download(`${name.replace(/\s+/g, "-").toLowerCase()}.json`, {
                name,
                version: 1,
                nodes,
                edges,
              })
            }
          >
            <Download size={13} aria-hidden />
            Export
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) loadDocument(JSON.parse(await file.text()) as LoomDoc);
              e.target.value = "";
            }}
          />

          <div className="mx-1 h-5 w-px bg-line" />

          {steps.length > 0 && (
            <span className="tnum flex items-center gap-2 pr-1 font-mono text-micro text-text-faint">
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`}
              />
              {status} · {steps.length} steps
            </span>
          )}

          <button
            onClick={() => setKeyOpen((v) => !v)}
            aria-expanded={keyOpen}
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-meta transition-colors ${
              apiKey
                ? "border-line bg-ink-700 text-text-dim hover:text-text"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200/90 hover:bg-amber-400/15"
            }`}
          >
            <KeyRound size={13} aria-hidden />
            {apiKey ? "Live model" : "Demo model"}
          </button>
        </div>
      </header>

      {keyOpen && (
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-ink-800 px-4 py-3">
          <input
            type="password"
            aria-label="Anthropic API key"
            placeholder="sk-ant-…"
            className={`${control} max-w-md font-mono`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="max-w-lg text-meta text-text-dim">
            Stored in this browser and sent only to api.anthropic.com. Leave it
            empty to run against canned responses instead, which is enough to
            exercise every branch in the examples.
          </p>
        </div>
      )}

      <main className="flex min-h-0 flex-1">
        {mode === "build" && (
          <aside
            className={`flex shrink-0 flex-col border-r border-line bg-ink-800 transition-[width] duration-150 ${
              railOpen ? "w-44" : "w-[52px]"
            }`}
          >
            <div className="flex-1 space-y-0.5 p-2">
              {railOpen && (
                <p className="px-2 pb-1.5 pt-1 text-meta text-text-dim">
                  Add a node
                </p>
              )}
              {NODE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => addNode(t)}
                  title={`Add a ${NODE_LABEL[t].toLowerCase()} node`}
                  className={`flex w-full items-center rounded-md py-1.5 text-ui text-text-dim transition-colors hover:bg-ink-700 hover:text-text ${
                    railOpen ? "gap-2.5 px-2" : "flex-col gap-1 px-0"
                  }`}
                >
                  <TypeIcon type={t} size={15} />
                  {railOpen ? (
                    NODE_LABEL[t]
                  ) : (
                    <span className="font-mono text-micro">{NODE_CODE[t]}</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRailOpen((v) => !v)}
              className={`flex items-center gap-2 border-t border-line py-2.5 text-meta text-text-faint transition-colors hover:text-text ${
                railOpen ? "px-3" : "justify-center px-0"
              }`}
              aria-expanded={railOpen}
              aria-label={
                railOpen ? "Collapse the node rail" : "Expand the node rail"
              }
            >
              {railOpen ? (
                <PanelLeftClose size={14} aria-hidden />
              ) : (
                <PanelLeftOpen size={14} aria-hidden />
              )}
              {railOpen && "Collapse"}
            </button>
          </aside>
        )}

        {mode === "analyze" ? (
          <AnalyzePanel />
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <Canvas />
            </div>
            {/* The handle lives on the aside, not inside the scroller, or the scroll
                container clips it and the drag falls through to the canvas. */}
            <aside
              className="relative flex shrink-0 flex-col border-l border-line bg-ink-800"
              style={{ width: panel.width }}
            >
              <DragHandle {...panel} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {mode === "build" ? <ConfigPanel /> : <DebugPanel />}
              </div>
            </aside>
          </>
        )}
      </main>
    </div>
  );
}
