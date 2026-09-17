import { Background, Controls, MiniMap, ReactFlow, type Edge } from '@xyflow/react'
import { useMemo } from 'react'
import { useStore } from '../store.ts'
import { LoomNodeView } from './LoomNodeView.tsx'

const nodeTypes = { loom: LoomNodeView }

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, select, steps } = useStore()

  // Light up the edges this run actually traversed. Consecutive steps are, by definition,
  // one edge apart.
  const traversed = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i < steps.length - 1; i++) set.add(`${steps[i].nodeId}->${steps[i + 1].nodeId}`)
    return set
  }, [steps])

  const painted: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        animated: traversed.has(`${e.source}->${e.target}`),
        className: traversed.has(`${e.source}->${e.target}`) ? 'active' : undefined,
      })),
    [edges, traversed],
  )

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
      proOptions={{ hideAttribution: false }}
      className="bg-zinc-950"
    >
      <Background color="#27272a" gap={20} />
      <Controls className="!border-zinc-700 !bg-zinc-900 [&>button]:!border-zinc-700 [&>button]:!bg-zinc-900 [&>button]:!fill-zinc-300" />
      <MiniMap
        pannable
        className="!bg-zinc-900"
        maskColor="rgba(9,9,11,0.7)"
        nodeColor={() => '#3f3f46'}
      />
    </ReactFlow>
  )
}
