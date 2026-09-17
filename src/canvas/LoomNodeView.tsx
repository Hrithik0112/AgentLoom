import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  GitBranch,
  LogIn,
  LogOut,
  Repeat,
  Sparkles,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { handlesOf, type LoomNode } from "../lib/graph.ts";
import { ms, nodeStats, usd } from "../lib/stats.ts";
import { useStore } from "../store.ts";

/** Node type is the one thing on a card that is color-coded, so the hues stay distinct. */
export const TYPE_COLOR: Record<string, string> = {
  input: "#38bdf8",
  llm: "#a78bfa",
  tool: "#fbbf24",
  condition: "#4ade80",
  loop: "#22d3ee",
  approval: "#fb7185",
  output: "#94a3b8",
};

/** A dot only says which color. The glyph says what the node actually does. */
export const TYPE_ICON: Record<string, LucideIcon> = {
  input: LogIn,
  llm: Sparkles,
  tool: Wrench,
  condition: GitBranch,
  loop: Repeat,
  approval: UserCheck,
  output: LogOut,
};

export function TypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const Icon = TYPE_ICON[type] ?? Sparkles;
  return (
    <Icon
      aria-hidden
      size={size}
      strokeWidth={2}
      className="shrink-0"
      style={{ color: TYPE_COLOR[type] }}
    />
  );
}

/** One line on what the node will do, so a card is readable without opening it. */
function summarize(data: LoomNode["data"]): string {
  const c = data.config as Record<string, string>;
  switch (data.type) {
    case "llm":
      return `${c.model ?? "claude-opus-5"} → ${c.outputKey}`;
    case "tool":
      return c.kind === "js"
        ? `worker js → ${c.outputKey}`
        : `${c.method ?? "GET"} → ${c.outputKey}`;
    case "condition": {
      const n = (data.config.branches as unknown[])?.length ?? 0;
      return `${n + 1} way branch`;
    }
    case "loop":
      return c.over ? `for each ${c.over}` : `while ${c.while ?? "…"}`;
    case "approval":
      return "waits for a person";
    case "input":
      return "entry point";
    default:
      return "run ends here";
  }
}

export function LoomNodeView({ id, data, selected }: NodeProps<LoomNode>) {
  const runs = useStore((s) => s.runs);
  const breakpoints = useStore((s) => s.breakpoints);
  const toggleBreakpoint = useStore((s) => s.toggleBreakpoint);
  const steps = useStore((s) => s.steps);
  const currentStep = useStore((s) => s.currentStep);

  const stat = useMemo(() => nodeStats(runs)[id], [runs, id]);
  const live = currentStep !== null && steps[currentStep]?.nodeId === id;
  const visited = steps.some((s) => s.nodeId === id);
  const armed = breakpoints.includes(id);
  const branches = handlesOf(data);

  return (
    <div
      className={[
        "w-60 rounded-[10px] border bg-ink-700 transition-colors",
        live
          ? "border-live shadow-[0_0_0_3px_rgba(74,222,128,0.16)]"
          : selected
            ? "border-pick"
            : visited
              ? "border-line-bright"
              : "border-line",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
        <TypeIcon type={data.type} />
        <span className="min-w-0 flex-1 truncate text-ui font-medium text-text">
          {data.label}
        </span>
        <button
          aria-label={
            armed
              ? `Clear breakpoint on ${data.label}`
              : `Break before ${data.label}`
          }
          aria-pressed={armed}
          title={armed ? "Clear breakpoint" : "Break before this node"}
          onClick={(e) => {
            e.stopPropagation();
            toggleBreakpoint(id);
          }}
          className={[
            "h-3.5 w-3.5 shrink-0 rounded-full border transition-colors",
            armed
              ? "border-halt bg-halt"
              : "border-line-bright hover:border-halt",
          ].join(" ")}
        />
      </div>

      <div className="space-y-1.5 px-3 py-2.5">
        <div className="truncate font-mono text-meta text-text-dim">
          {summarize(data)}
        </div>
        <div className="tnum flex gap-3 font-mono text-micro text-text-faint">
          {!stat ? (
            <span>Not run yet</span>
          ) : stat.avgLatencyMs === undefined &&
            stat.avgCostUsd === undefined ? (
            // Routing and control nodes cost nothing and take no measurable time, so the
            // only honest number for them is how often they were reached.
            <span>{stat.visits} visits</span>
          ) : (
            <>
              <span title="Average latency across stored runs">
                {ms(stat.avgLatencyMs)}
              </span>
              <span title="Average cost across stored runs">
                {usd(stat.avgCostUsd)}
              </span>
            </>
          )}
          {stat && stat.errors > 0 && (
            <span className="text-halt">{stat.errors} failed</span>
          )}
        </div>
      </div>

      {branches.length === 0 ? (
        data.type === "output" ? null : (
          <Handle type="source" position={Position.Right} />
        )
      ) : (
        <div className="border-t border-line py-1">
          {branches.map((handle) => (
            <div
              key={handle}
              className="relative px-3 py-1 text-right font-mono text-micro text-text-dim"
            >
              {handle}
              {/* Inside a relative row, so React Flow centers the handle on this branch line. */}
              <Handle id={handle} type="source" position={Position.Right} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
