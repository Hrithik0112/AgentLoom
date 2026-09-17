import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
} from "@xyflow/react";
import { useMemo } from "react";
import { useStore } from "../store.ts";
import { LoomNodeView, TYPE_COLOR } from "./LoomNodeView.tsx";

const nodeTypes = { loom: LoomNodeView };

export function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    select,
    steps,
  } = useStore();

  // Light up the edges this run actually traversed. Consecutive steps are, by definition,
  // one edge apart.
  const traversed = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < steps.length - 1; i++)
      set.add(`${steps[i].nodeId}->${steps[i + 1].nodeId}`);
    return set;
  }, [steps]);

  const painted: Edge[] = useMemo(
    () =>
      edges.map((e) => {
        const hot = traversed.has(`${e.source}->${e.target}`);
        return {
          ...e,
          animated: hot,
          className: hot ? "traversed" : undefined,
        };
      }),
    [edges, traversed],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={painted}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, node) => select(node.id)}
      onPaneClick={() => select(null)}
      fitView
      fitViewOptions={{ padding: 0.16, minZoom: 0.7, maxZoom: 1 }}
      minZoom={0.2}
      className="bg-surface"
    >
      <Background color="var(--color-line)" gap={24} size={1.5} />
      <Controls
        showInteractive={false}
        className="!rounded-lg !border !border-line !bg-panel !shadow-none [&>button:hover]:!bg-elevated [&>button]:!border-0 [&>button]:!border-b [&>button]:!border-line [&>button]:!bg-panel [&>button]:!fill-text-dim"
      />
      <MiniMap
        pannable
        zoomable
        className="!rounded-lg !border !border-line !bg-panel"
        maskColor="color-mix(in oklab, var(--color-surface) 78%, transparent)"
        nodeColor={(n) =>
          TYPE_COLOR[(n.data as { type: string }).type] ?? "#94a3b8"
        }
        nodeStrokeWidth={0}
      />
    </ReactFlow>
  );
}
