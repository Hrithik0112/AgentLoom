import type { Edge as RFEdge, Node as RFNode } from "@xyflow/react";
import type {
  AgentNode,
  Graph,
  NodeType,
} from "../../packages/engine/index.ts";

/** What the canvas stores on each node. Deliberately separate from the engine's AgentNode. */
export type NodeData = {
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
};

export type LoomNode = RFNode<NodeData>;

export const NODE_TYPES: NodeType[] = [
  "input",
  "llm",
  "tool",
  "condition",
  "loop",
  "approval",
  "output",
];

export const DEFAULT_CONFIG: Record<NodeType, Record<string, unknown>> = {
  input: { seed: {} },
  llm: {
    prompt: "Answer this: {{ question }}",
    outputKey: "answer",
    model: "claude-opus-5",
  },
  tool: {
    kind: "http",
    url: "https://api.example.com/{{ id }}",
    method: "GET",
    outputKey: "result",
  },
  condition: { branches: [{ handle: "yes", expr: "intent === 'billing'" }] },
  loop: { over: "items", itemKey: "item" },
  approval: { message: "Approve this step?" },
  output: {},
};

/** Branch labels a node emits, which become its source handles on the canvas. */
export function handlesOf(data: NodeData): string[] {
  if (data.type === "condition") {
    const branches = (data.config.branches ?? []) as { handle: string }[];
    return [...branches.map((b) => b.handle), "else"];
  }
  if (data.type === "loop") return ["body", "done"];
  return [];
}

/**
 * The node's input schema, derived rather than declared: every state key it interpolates
 * or tests. Derived beats declared here because it cannot drift from the actual config.
 */
export function readsOf(data: NodeData): string[] {
  const c = data.config as Record<string, unknown>;
  const sources = [c.prompt, c.system, c.url, c.body, c.over, c.while]
    .filter((v): v is string => typeof v === "string")
    .concat(((c.branches as { expr: string }[]) ?? []).map((b) => b.expr));
  const keys = new Set<string>();
  for (const text of sources) {
    for (const [, path] of text.matchAll(/\{\{\s*([\w.$]+)\s*\}\}/g))
      keys.add(path);
  }
  if (typeof c.over === "string") keys.add(c.over);
  for (const b of (c.branches as { expr: string }[]) ?? []) {
    for (const [, id] of b.expr.matchAll(/\b([a-zA-Z_$][\w$]*)\b/g)) {
      if (
        ![
          "true",
          "false",
          "null",
          "undefined",
          "typeof",
          "includes",
          "length",
        ].includes(id)
      )
        keys.add(id);
    }
  }
  return [...keys];
}

/** The state keys the node writes. */
export function writesOf(data: NodeData): string[] {
  const c = data.config as Record<string, unknown>;
  const keys: string[] = [];
  if (typeof c.outputKey === "string") keys.push(c.outputKey);
  if (typeof c.itemKey === "string") keys.push(c.itemKey);
  if (data.type === "input")
    keys.push(...Object.keys((c.seed as object) ?? {}));
  return keys;
}

/** Canvas -> engine. The one place editor shapes get cast into engine shapes. */
export function toGraph(
  nodes: LoomNode[],
  edges: RFEdge[],
  meta: Partial<Graph> = {},
): Graph {
  const entry = nodes.find((n) => n.data.type === "input")?.id ?? nodes[0]?.id;
  if (!entry) throw new Error("The graph needs at least one node");
  return {
    ...meta,
    entry,
    nodes: nodes.map(
      (n) =>
        ({
          id: n.id,
          type: n.data.type,
          label: n.data.label,
          config: n.data.config,
        }) as AgentNode,
    ),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
      handle: e.sourceHandle ?? undefined,
    })),
  };
}

export type LoomDoc = {
  name: string;
  version: number;
  nodes: LoomNode[];
  edges: RFEdge[];
};
