import type { RunRecord } from "./persist.ts";

export type NodeStat = {
  visits: number;
  errors: number;
  avgLatencyMs?: number;
  avgCostUsd?: number;
  totalCostUsd: number;
};

/** Per-node aggregates across every stored run. Feeds the Build-mode node cards and the heatmap. */
export function nodeStats(runs: RunRecord[]): Record<string, NodeStat> {
  const out: Record<string, NodeStat & { _lat: number[]; _cost: number[] }> =
    {};
  for (const run of runs) {
    for (const step of run.steps) {
      const s = (out[step.nodeId] ??= {
        visits: 0,
        errors: 0,
        totalCostUsd: 0,
        _lat: [],
        _cost: [],
      });
      s.visits++;
      if (step.status === "error") s.errors++;
      if (step.meta?.latencyMs !== undefined) s._lat.push(step.meta.latencyMs);
      if (step.meta?.costUsd !== undefined) {
        s._cost.push(step.meta.costUsd);
        s.totalCostUsd += step.meta.costUsd;
      }
    }
  }
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
  return Object.fromEntries(
    Object.entries(out).map(([id, s]) => [
      id,
      {
        visits: s.visits,
        errors: s.errors,
        totalCostUsd: s.totalCostUsd,
        avgLatencyMs: mean(s._lat),
        avgCostUsd: mean(s._cost),
      },
    ]),
  );
}

/** Edge traversal counts across runs, in the shape d3-sankey wants. */
export function pathCounts(
  runs: RunRecord[],
): { source: string; target: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const run of runs) {
    for (let i = 0; i < run.steps.length - 1; i++) {
      const key = `${run.steps[i].nodeId} ${run.steps[i + 1].nodeId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts].map(([key, value]) => {
    const [source, target] = key.split(" ");
    return { source, target, value };
  });
}

export const usd = (n?: number) =>
  n === undefined ? "-" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
export const ms = (n?: number) =>
  n === undefined
    ? "-"
    : n < 1000
      ? `${Math.round(n)}ms`
      : `${(n / 1000).toFixed(1)}s`;
