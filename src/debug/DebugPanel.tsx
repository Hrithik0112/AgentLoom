import {
  Ban,
  Check,
  FastForward,
  History,
  Play,
  Square,
  StepForward,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { State, StepEvent } from "../../packages/engine/index.ts";
import { TypeIcon } from "../canvas/LoomNodeView.tsx";
import { ms, usd } from "../lib/stats.ts";
import { useStore } from "../store.ts";
import { button, control, Field } from "../ui.tsx";

const show = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v, null, 2);

/** What this step changed. The diff is the question you are actually asking, not the dump. */
function Diff({ step }: { step: StepEvent }) {
  const keys = [
    ...new Set([
      ...Object.keys(step.stateBefore),
      ...Object.keys(step.stateAfter),
    ]),
  ];
  const changed = keys.filter(
    (k) => show(step.stateBefore[k]) !== show(step.stateAfter[k]),
  );
  if (!changed.length)
    return (
      <p className="text-meta text-text-faint">
        This step left the state unchanged.
      </p>
    );
  return (
    <div className="space-y-3">
      {changed.map((k) => (
        <div key={k} className="space-y-1">
          <div className="font-mono text-micro text-text-dim">{k}</div>
          {k in step.stateBefore && (
            <div className="whitespace-pre-wrap break-words rounded-md border-l-2 border-halt/60 bg-halt/10 px-2.5 py-1.5 font-mono text-meta text-diff-del">
              {show(step.stateBefore[k])}
            </div>
          )}
          <div className="whitespace-pre-wrap break-words rounded-md border-l-2 border-live/60 bg-live/10 px-2.5 py-1.5 font-mono text-meta text-diff-add">
            {show(step.stateAfter[k])}
          </div>
        </div>
      ))}
    </div>
  );
}

function Inspector({ step }: { step: StepEvent }) {
  const [tab, setTab] = useState<"changed" | "state" | "prompt">("changed");
  const rewindTo = useStore((s) => s.rewindTo);
  const [edit, setEdit] = useState("");

  useEffect(() => setTab("changed"), [step.step]);

  const tabs = [
    ["changed", "What changed"],
    ["state", "Full state"],
    ["prompt", "Prompt sent"],
  ] as const;

  return (
    <div className="space-y-4 border-t border-line p-4">
      <div className="flex items-center gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-md px-2.5 py-1 text-meta transition-colors ${
              tab === id
                ? "bg-elevated text-text"
                : "text-text-dim hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="tnum ml-auto font-mono text-micro text-text-faint">
          {ms(step.meta?.latencyMs)} {usd(step.meta?.costUsd)}
        </span>
      </div>

      {step.meta?.error && (
        <div className="rounded-md border border-halt/40 bg-halt/10 px-2.5 py-2 font-mono text-meta text-diff-del">
          {step.meta.error}
        </div>
      )}

      {tab === "changed" && <Diff step={step} />}

      {tab === "state" && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface p-3 font-mono text-meta text-text-dim">
          {JSON.stringify(step.stateAfter, null, 2)}
        </pre>
      )}

      {tab === "prompt" &&
        (step.meta?.prompt ? (
          <div className="space-y-3">
            {step.meta.system && (
              <div className="space-y-1">
                <div className="text-meta text-text-faint">System</div>
                <pre className="whitespace-pre-wrap break-words rounded-md bg-surface p-3 font-mono text-meta text-text-dim">
                  {step.meta.system}
                </pre>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-meta text-text-faint">Sent to</span>
                <span className="font-mono text-micro text-text-dim">
                  {step.meta.model}
                </span>
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface p-3 font-mono text-meta text-pick">
                {step.meta.prompt}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-meta text-text-faint">Came back</div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface p-3 font-mono text-meta text-model">
                {step.meta.response}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-meta text-text-faint">
            This step did not call a model.
          </p>
        ))}

      <div className="space-y-2 border-t border-line pt-4">
        <Field label="Run again from here" hint="state changes to apply first">
          <textarea
            className={`${control} h-20 font-mono text-meta`}
            placeholder={'{ "intent": "technical" }'}
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
          />
        </Field>
        <button
          className={`${button} inline-flex items-center gap-1.5`}
          onClick={() => {
            let patch: State = {};
            try {
              patch = edit.trim() ? JSON.parse(edit) : {};
            } catch {
              return;
            }
            rewindTo(step.step, patch);
          }}
        >
          <History size={13} aria-hidden />
          Replay from step {step.step}
        </button>
      </div>
    </div>
  );
}

export function DebugPanel() {
  const {
    status,
    steps,
    currentStep,
    error,
    input,
    setInput,
    start,
    stepOnce,
    resume,
    stop,
    inspect,
    editState,
    breakpoints,
    nodes,
  } = useStore();

  const running = status === "running";
  const held = status === "paused" || status === "awaiting-approval";
  const selected = currentStep !== null ? steps[currentStep] : undefined;
  const totalCost = steps.reduce((sum, s) => sum + (s.meta?.costUsd ?? 0), 0);
  const typeOf = (id: string) =>
    nodes.find((n) => n.id === id)?.data.type ?? "output";

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-4">
        <Field label="Starting state" hint="JSON">
          <textarea
            className={`${control} h-24 font-mono text-meta`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>

        <div data-tour="transport" className="flex flex-wrap gap-1.5">
          {(
            [
              [Play, "Run", start, running],
              [StepForward, "Step", stepOnce, running],
              [FastForward, "Continue", resume, !held],
              [Square, "Stop", stop, status === "idle"],
            ] as const
          ).map(([Icon, label, onClick, disabled]) => (
            <button
              key={label}
              className={`${button} inline-flex items-center gap-1.5`}
              onClick={onClick}
              disabled={disabled}
            >
              <Icon size={13} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="tnum flex items-center gap-3 font-mono text-micro">
          <span
            className={
              status === "error" || status === "halted"
                ? "text-halt"
                : running
                  ? "text-warn"
                  : status === "done"
                    ? "text-live"
                    : "text-text-dim"
            }
          >
            {status}
          </span>
          <span className="text-text-faint">
            {steps.length} steps · {usd(totalCost)}
          </span>
          {breakpoints.length > 0 && (
            <span className="text-halt">
              {breakpoints.length} breakpoint{breakpoints.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-halt/40 bg-halt/10 px-2.5 py-2 font-mono text-meta text-diff-del">
            {error}
          </div>
        )}

        {status === "awaiting-approval" && (
          <div className="space-y-2.5 rounded-lg border border-halt/40 bg-halt/10 p-3">
            <p className="text-ui text-text">
              {selected?.meta?.response ?? "This run is waiting on you."}
            </p>
            <div className="flex gap-1.5">
              <button
                className={`${button} inline-flex items-center gap-1.5`}
                onClick={() => {
                  editState({ approved: true });
                  resume();
                }}
              >
                <Check size={13} aria-hidden />
                Approve
              </button>
              <button
                className={`${button} inline-flex items-center gap-1.5`}
                onClick={() => {
                  editState({ approved: false });
                  resume();
                }}
              >
                <Ban size={13} aria-hidden />
                Reject
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
        {steps.length === 0 ? (
          <p className="p-4 text-meta text-text-faint">
            Run the workflow to see each step land here. Click a node's dot to
            break before it.
          </p>
        ) : (
          <>
            <div>
              {steps.map((s) => (
                <button
                  key={s.step}
                  onClick={() => inspect(s.step)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-raised ${
                    currentStep === s.step ? "bg-elevated" : ""
                  }`}
                >
                  <span className="tnum w-5 shrink-0 text-right font-mono text-micro text-text-faint">
                    {s.step}
                  </span>
                  <TypeIcon type={typeOf(s.nodeId)} size={13} />
                  <span className="min-w-0 flex-1 truncate text-ui text-text">
                    {s.label ?? s.nodeId}
                  </span>
                  {s.handle && (
                    <span className="font-mono text-micro text-live">
                      {s.handle}
                    </span>
                  )}
                  {s.status === "error" && (
                    <span className="text-micro text-halt">failed</span>
                  )}
                </button>
              ))}
            </div>
            {selected && <Inspector step={selected} />}
          </>
        )}
      </div>
    </div>
  );
}
