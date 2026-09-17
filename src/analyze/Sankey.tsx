import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { useMemo } from "react";
import type { RunRecord } from "../lib/persist.ts";
import { pathCounts } from "../lib/stats.ts";

type N = { id: string; x0?: number; x1?: number; y0?: number; y1?: number };
type L = { source: N; target: N; width?: number; value: number };

const WIDTH = 900;
const HEIGHT = 200;
// Room on the right so the last node's label is not clipped by the viewBox.
const LABEL_GUTTER = 72;

export function Sankey({ runs }: { runs: RunRecord[] }) {
  const layout = useMemo(() => {
    const links = pathCounts(runs).filter((l) => l.source !== l.target);
    if (!links.length) return null;
    const ids = [...new Set(links.flatMap((l) => [l.source, l.target]))];
    const index = new Map(ids.map((id, i) => [id, i]));
    try {
      return sankey<N, L>()
        .nodeWidth(14)
        .nodePadding(14)
        .extent([
          [4, 4],
          [WIDTH - LABEL_GUTTER, HEIGHT - 4],
        ])({
        nodes: ids.map((id) => ({ id })),
        links: links.map((l) => ({
          ...l,
          source: index.get(l.source)!,
          target: index.get(l.target)!,
        })),
      } as never);
    } catch {
      // ponytail: d3-sankey rejects cycles, and a loop node is a legitimate cycle. Fall back
      // to the ranked table below rather than hiding the data. Layered layout if asked.
      return null;
    }
  }, [runs]);

  const ranked = useMemo(
    () => pathCounts(runs).sort((a, b) => b.value - a.value),
    [runs],
  );

  if (!ranked.length) return null;

  if (!layout) {
    return (
      <div className="space-y-3">
        <p className="text-meta text-text-dim">
          This workflow loops, so it cannot be laid out left to right. Here is
          the same data as counts.
        </p>
        <table className="w-full max-w-lg">
          {/* A loop's own back edge is a real path, so it belongs in the count even when it
              breaks the diagram. */}
          <tbody>
            {ranked.map((l) => (
              <tr
                key={`${l.source}-${l.target}`}
                className="border-b border-line/60"
              >
                <td className="py-1.5 font-mono text-meta text-text">
                  {l.source} <span className="text-text-faint">to</span>{" "}
                  {l.target}
                </td>
                <td className="tnum w-20 py-1.5 text-right font-mono text-meta text-text-dim">
                  {l.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const max = Math.max(...layout.links.map((l) => l.value));

  return (
    // Capped so the diagram keeps its aspect ratio instead of stretching to the panel width.
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
      {layout.links.map((l, i) => (
        <path
          key={i}
          d={sankeyLinkHorizontal<N, L>()(l) ?? undefined}
          fill="none"
          stroke="var(--color-live)"
          strokeOpacity={0.12 + 0.28 * (l.value / max)}
          strokeWidth={Math.max(1, l.width ?? 1)}
        >
          <title>
            {l.source.id} to {l.target.id}: {l.value}
          </title>
        </path>
      ))}
      {layout.nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={n.x0}
            y={n.y0}
            width={(n.x1 ?? 0) - (n.x0 ?? 0)}
            height={(n.y1 ?? 0) - (n.y0 ?? 0)}
            rx={2}
            fill="var(--color-text-dim)"
          />
          {/* A band can be thick enough to sit right under the label, so the label carries
              its own background as a stroke rather than relying on the gap. */}
          <text
            x={(n.x1 ?? 0) + 7}
            y={(n.y0 ?? 0) + 12}
            fill="var(--color-text)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            stroke="var(--color-surface)"
            strokeWidth={3.5}
            paintOrder="stroke"
          >
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
