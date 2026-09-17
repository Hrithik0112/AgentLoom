import { Fragment, useEffect, useMemo, useState } from 'react'
import { run, type RunResult, type State } from '../../packages/engine/index.ts'
import { runContext } from '../lib/context.ts'
import { toGraph, type LoomDoc } from '../lib/graph.ts'
import { loadVersions, saveVersion } from '../lib/persist.ts'
import { ms, nodeStats, usd } from '../lib/stats.ts'
import { useStore } from '../store.ts'
import { Sankey } from './Sankey.tsx'

type Scenario = { name: string; input: State; expect?: State }
type Cell = { result?: RunResult; cost: number; latency: number; pass?: boolean }

const btn = 'rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs hover:border-zinc-500 disabled:opacity-40'

const totals = (r: RunResult) => ({
  cost: r.steps.reduce((s, x) => s + (x.meta?.costUsd ?? 0), 0),
  latency: r.steps.reduce((s, x) => s + (x.meta?.latencyMs ?? 0), 0),
})

/** Exact match on the keys the scenario names. Anything subtler is a manual call. */
const matches = (state: State, expect?: State) =>
  expect ? Object.entries(expect).every(([k, v]) => JSON.stringify(state[k]) === JSON.stringify(v)) : undefined

const DEFAULT_SUITE = JSON.stringify(
  [
    { name: 'double charge', input: { ticket: 'I was charged twice this month' }, expect: {} },
    { name: 'app crash', input: { ticket: 'The app crashes when I open settings' } },
  ],
  null,
  2,
)

export function AnalyzePanel() {
  const { runs, refreshRuns, nodes, edges, name, apiKey } = useStore()
  const [versions, setVersions] = useState<LoomDoc[]>(loadVersions)
  const [a, setA] = useState(0)
  const [b, setB] = useState(1)
  const [suite, setSuite] = useState(DEFAULT_SUITE)
  const [grid, setGrid] = useState<Record<string, Cell>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    refreshRuns()
  }, [refreshRuns])

  const stats = useMemo(() => nodeStats(runs), [runs])
  const worst = Math.max(1, ...Object.values(stats).map((s) => s.avgLatencyMs ?? 0))

  const snapshot = () => setVersions(saveVersion({ name, version: 0, nodes, edges }))

  const compare = async () => {
    setErr(null)
    let scenarios: Scenario[]
    try {
      scenarios = JSON.parse(suite)
    } catch {
      return setErr('The test suite is not valid JSON')
    }
    const picked = [versions[a], versions[b]].filter(Boolean)
    if (picked.length < 2) return setErr('Snapshot at least two versions to compare')

    setBusy(true)
    const ctx = runContext(apiKey)
    const next: Record<string, Cell> = {}
    for (const [vi, doc] of picked.entries()) {
      for (const scenario of scenarios) {
        try {
          const result = await run(toGraph(doc.nodes, doc.edges, { name: doc.name }), scenario.input, ctx)
          next[`${vi}:${scenario.name}`] = {
            result,
            ...totals(result),
            pass: matches(result.state, scenario.expect),
          }
        } catch (e) {
          next[`${vi}:${scenario.name}`] = { cost: 0, latency: 0, pass: false }
          setErr((e as Error).message)
        }
        setGrid({ ...next })
      }
    }
    setBusy(false)
    refreshRuns()
  }

  let scenarios: Scenario[] = []
  try {
    scenarios = JSON.parse(suite)
  } catch {
    /* the error is surfaced on compare */
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <section className="border-b border-zinc-800">
        <h2 className="px-4 pt-4 text-xs uppercase tracking-wide text-zinc-500">
          path frequency across {runs.length} runs
        </h2>
        <Sankey runs={runs} />
      </section>

      <section className="border-b border-zinc-800 p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-zinc-500">per node</h2>
        <table className="w-full text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="text-left font-normal">node</th>
              <th className="text-right font-normal">visits</th>
              <th className="text-right font-normal">avg latency</th>
              <th className="text-right font-normal">avg cost</th>
              <th className="text-right font-normal">total cost</th>
              <th className="text-right font-normal">errors</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats).map(([id, s]) => (
              <tr key={id} className="border-t border-zinc-900">
                <td className="py-1 font-mono text-zinc-300">{id}</td>
                <td className="py-1 text-right font-mono text-zinc-400">{s.visits}</td>
                <td
                  className="py-1 text-right font-mono"
                  style={{ color: `color-mix(in oklab, #f87171 ${((s.avgLatencyMs ?? 0) / worst) * 100}%, #a1a1aa)` }}
                >
                  {ms(s.avgLatencyMs)}
                </td>
                <td className="py-1 text-right font-mono text-zinc-400">{usd(s.avgCostUsd)}</td>
                <td className="py-1 text-right font-mono text-zinc-400">{usd(s.totalCostUsd)}</td>
                <td className={`py-1 text-right font-mono ${s.errors ? 'text-red-400' : 'text-zinc-600'}`}>
                  {s.errors}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs uppercase tracking-wide text-zinc-500">version comparison</h2>
          <button className={`${btn} ml-auto`} onClick={snapshot}>
            snapshot current graph
          </button>
        </div>

        <div className="flex gap-2">
          {[
            [a, setA, 'A'],
            [b, setB, 'B'],
          ].map(([value, setValue, tag]) => (
            <select
              key={tag as string}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              value={value as number}
              onChange={(e) => (setValue as (n: number) => void)(Number(e.target.value))}
            >
              {versions.map((v, i) => (
                <option key={i} value={i}>
                  {tag as string}: v{v.version} {v.name}
                </option>
              ))}
            </select>
          ))}
          <button className={btn} onClick={compare} disabled={busy}>
            {busy ? 'running...' : 'run suite against both'}
          </button>
        </div>

        <textarea
          className="h-32 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] outline-none focus:border-sky-500"
          value={suite}
          onChange={(e) => setSuite(e.target.value)}
        />
        {err && <div className="rounded bg-red-950/50 px-2 py-1 font-mono text-[11px] text-red-300">{err}</div>}

        {Object.keys(grid).length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-normal">scenario</th>
                <th className="text-right font-normal">A cost</th>
                <th className="text-right font-normal">A time</th>
                <th className="text-right font-normal">A</th>
                <th className="text-right font-normal">B cost</th>
                <th className="text-right font-normal">B time</th>
                <th className="text-right font-normal">B</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const cells = [grid[`0:${s.name}`], grid[`1:${s.name}`]]
                return (
                  <tr key={s.name} className="border-t border-zinc-900">
                    <td className="py-1 text-zinc-300">{s.name}</td>
                    {cells.map((c, i) => (
                      <Fragment key={i}>
                        <td className="py-1 text-right font-mono text-zinc-400">{usd(c?.cost)}</td>
                        <td className="py-1 text-right font-mono text-zinc-400">{ms(c?.latency)}</td>
                        <td
                          className={`py-1 text-right font-mono ${c?.pass === false ? 'text-red-400' : c?.pass ? 'text-emerald-400' : 'text-zinc-600'}`}
                          title={JSON.stringify(c?.result?.state, null, 2)}
                        >
                          {c?.pass === undefined ? 'manual' : c.pass ? 'pass' : 'fail'}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
