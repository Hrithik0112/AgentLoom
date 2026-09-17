import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useMemo } from 'react'
import { handlesOf, type LoomNode } from '../lib/graph.ts'
import { ms, nodeStats, usd } from '../lib/stats.ts'
import { useStore } from '../store.ts'

export const TYPE_COLOR: Record<string, string> = {
  input: 'bg-sky-400',
  llm: 'bg-violet-400',
  tool: 'bg-amber-400',
  condition: 'bg-emerald-400',
  loop: 'bg-cyan-400',
  approval: 'bg-rose-400',
  output: 'bg-zinc-400',
}

/** One-line summary of what the node will do, so the card is readable without opening it. */
function summarize(data: LoomNode['data']): string {
  const c = data.config as Record<string, string>
  switch (data.type) {
    case 'llm':
      return `${c.model ?? 'claude-opus-5'} -> ${c.outputKey}`
    case 'tool':
      return c.kind === 'js' ? `js -> ${c.outputKey}` : `${c.method ?? 'GET'} -> ${c.outputKey}`
    case 'condition':
      return `${(data.config.branches as unknown[])?.length ?? 0} branches`
    case 'loop':
      return c.over ? `over ${c.over}` : `while ${c.while ?? '...'}`
    default:
      return data.type
  }
}

export function LoomNodeView({ id, data, selected }: NodeProps<LoomNode>) {
  const runs = useStore((s) => s.runs)
  const breakpoints = useStore((s) => s.breakpoints)
  const toggleBreakpoint = useStore((s) => s.toggleBreakpoint)
  const steps = useStore((s) => s.steps)
  const currentStep = useStore((s) => s.currentStep)

  const stat = useMemo(() => nodeStats(runs)[id], [runs, id])
  const live = currentStep !== null && steps[currentStep]?.nodeId === id
  const visited = steps.some((s) => s.nodeId === id)
  const branches = handlesOf(data)

  return (
    <div
      className={[
        'w-56 rounded-lg border bg-zinc-900/95 shadow-lg backdrop-blur transition',
        live
          ? 'border-emerald-400 ring-2 ring-emerald-400/40'
          : visited
            ? 'border-zinc-600'
            : 'border-zinc-800',
        selected ? 'ring-2 ring-sky-400/50' : '',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-zinc-600 !bg-zinc-700" />

      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span className={`h-2 w-2 rounded-full ${TYPE_COLOR[data.type]}`} />
        <span className="flex-1 truncate text-sm font-medium">{data.label}</span>
        <button
          title="Toggle breakpoint"
          onClick={(e) => {
            e.stopPropagation()
            toggleBreakpoint(id)
          }}
          className={[
            'h-3 w-3 rounded-full border transition',
            breakpoints.includes(id) ? 'border-red-400 bg-red-500' : 'border-zinc-600 hover:border-red-400',
          ].join(' ')}
        />
      </div>

      <div className="space-y-1 px-3 py-2">
        <div className="truncate font-mono text-[11px] text-zinc-400">{summarize(data)}</div>
        <div className="flex gap-3 font-mono text-[10px] text-zinc-500">
          <span title="average latency across stored runs">{ms(stat?.avgLatencyMs)}</span>
          <span title="average cost across stored runs">{usd(stat?.avgCostUsd)}</span>
          {stat?.errors ? <span className="text-red-400">{stat.errors} err</span> : null}
        </div>
      </div>

      {branches.length === 0 ? (
        data.type === 'output' ? null : (
          <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-zinc-600 !bg-zinc-700" />
        )
      ) : (
        <div className="border-t border-zinc-800">
          {branches.map((handle) => (
            <div key={handle} className="relative px-3 py-1 text-right font-mono text-[10px] text-zinc-400">
              {handle}
              {/* Inside a relative row, so React Flow centers the handle on this branch line. */}
              <Handle
                id={handle}
                type="source"
                position={Position.Right}
                className="!h-2 !w-2 !border-zinc-600 !bg-zinc-700"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
