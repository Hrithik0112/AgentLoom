import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { useMemo } from 'react'
import type { RunRecord } from '../lib/persist.ts'
import { pathCounts } from '../lib/stats.ts'

type N = { id: string; x0?: number; x1?: number; y0?: number; y1?: number }
type L = { source: N; target: N; width?: number; value: number }

const WIDTH = 900
const HEIGHT = 420

export function Sankey({ runs }: { runs: RunRecord[] }) {
  const layout = useMemo(() => {
    const links = pathCounts(runs).filter((l) => l.source !== l.target)
    if (!links.length) return null
    const ids = [...new Set(links.flatMap((l) => [l.source, l.target]))]
    const index = new Map(ids.map((id, i) => [id, i]))
    try {
      return sankey<N, L>()
        .nodeWidth(14)
        .nodePadding(14)
        .extent([
          [4, 4],
          [WIDTH - 4, HEIGHT - 4],
        ])({
        nodes: ids.map((id) => ({ id })),
        links: links.map((l) => ({ ...l, source: index.get(l.source)!, target: index.get(l.target)! })),
      } as never)
    } catch {
      // ponytail: d3-sankey rejects cycles, and a loop node is a legitimate cycle. Fall back
      // to the ranked table below rather than hiding the data. Layered layout if asked.
      return null
    }
  }, [runs])

  const ranked = useMemo(() => pathCounts(runs).sort((a, b) => b.value - a.value), [runs])

  if (!ranked.length) return <p className="p-6 text-sm text-zinc-500">No runs recorded yet.</p>

  if (!layout) {
    return (
      <div className="p-4">
        <p className="mb-3 text-xs text-zinc-500">
          This graph has a cycle, so it cannot be drawn as a Sankey. Path frequencies:
        </p>
        <table className="w-full text-xs">
          <tbody>
            {ranked.map((l) => (
              <tr key={`${l.source}-${l.target}`} className="border-b border-zinc-900">
                <td className="py-1 font-mono text-zinc-300">
                  {l.source} to {l.target}
                </td>
                <td className="w-24 py-1 text-right font-mono text-zinc-500">{l.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const max = Math.max(...layout.links.map((l) => l.value))

  return (
    // Capped so the diagram keeps its aspect ratio instead of stretching to the panel width.
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-3xl p-4">
      {layout.links.map((l, i) => (
        <path
          key={i}
          d={sankeyLinkHorizontal<N, L>()(l) ?? undefined}
          fill="none"
          stroke="#34d399"
          strokeOpacity={0.15 + 0.5 * (l.value / max)}
          strokeWidth={Math.max(1, l.width ?? 1)}
        >
          <title>
            {l.source.id} to {l.target.id}: {l.value}
          </title>
        </path>
      ))}
      {layout.nodes.map((n) => (
        <g key={n.id}>
          <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={(n.y1 ?? 0) - (n.y0 ?? 0)} fill="#a1a1aa" />
          <text x={(n.x1 ?? 0) + 6} y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2} dy="0.35em" fill="#d4d4d8" fontSize={11}>
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  )
}
