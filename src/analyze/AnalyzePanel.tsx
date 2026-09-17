import { Fragment, useEffect, useMemo, useState } from "react";
import {
  run,
  type RunResult,
  type State,
} from "../../packages/engine/index.ts";
import { runContext } from "../lib/context.ts";
import { toGraph, type LoomDoc } from "../lib/graph.ts";
import { loadVersions, saveVersion } from "../lib/persist.ts";
import { ms, nodeStats, usd } from "../lib/stats.ts";
import { useStore } from "../store.ts";
import { button, control, Field, SectionTitle } from "../ui.tsx";
import { Sankey } from "./Sankey.tsx";

type Scenario = { name: string; input: State; expect?: State };
type Cell = {
  result?: RunResult;
  cost: number;
  latency: number;
  pass?: boolean;
};

const totals = (r: RunResult) => ({
  cost: r.steps.reduce((s, x) => s + (x.meta?.costUsd ?? 0), 0),
  latency: r.steps.reduce((s, x) => s + (x.meta?.latencyMs ?? 0), 0),
});

/** Exact match on the keys the scenario names. Anything subtler is a judgement call. */
const matches = (state: State, expect?: State) =>
  expect
    ? Object.entries(expect).every(
        ([k, v]) => JSON.stringify(state[k]) === JSON.stringify(v),
      )
    : undefined;

const DEFAULT_SUITE = JSON.stringify(
  [
    {
      name: "double charge",
      input: { ticket: "I was charged twice this month" },
      expect: {},
    },
    {
      name: "app crash",
      input: { ticket: "The app crashes when I open settings" },
    },
  ],
  null,
  2,
);

const th = "pb-2 text-left text-meta font-normal text-text-faint";
const thNum = "pb-2 text-right text-meta font-normal text-text-faint";
const td = "py-2 text-ui text-text";
const tdNum = "tnum py-2 text-right font-mono text-meta text-text-dim";

export function AnalyzePanel() {
  const { runs, refreshRuns, nodes, edges, name, apiKey } = useStore();
  const [versions, setVersions] = useState<LoomDoc[]>(loadVersions);
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const [suite, setSuite] = useState(DEFAULT_SUITE);
  const [grid, setGrid] = useState<Record<string, Cell>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  const stats = useMemo(() => nodeStats(runs), [runs]);
  const slowest = Math.max(
    1,
    ...Object.values(stats).map((s) => s.avgLatencyMs ?? 0),
  );

  const snapshot = () =>
    setVersions(saveVersion({ name, version: 0, nodes, edges }));

  const compare = async () => {
    setErr(null);
    let scenarios: Scenario[];
    try {
      scenarios = JSON.parse(suite);
    } catch {
      return setErr("That test suite is not valid JSON.");
    }
    const picked = [versions[a], versions[b]].filter(Boolean);
    if (picked.length < 2)
      return setErr("Save at least two versions before comparing.");

    setBusy(true);
    const ctx = runContext(apiKey);
    const next: Record<string, Cell> = {};
    for (const [vi, doc] of picked.entries()) {
      for (const scenario of scenarios) {
        try {
          const result = await run(
            toGraph(doc.nodes, doc.edges, { name: doc.name }),
            scenario.input,
            ctx,
          );
          next[`${vi}:${scenario.name}`] = {
            result,
            ...totals(result),
            pass: matches(result.state, scenario.expect),
          };
        } catch (e) {
          next[`${vi}:${scenario.name}`] = { cost: 0, latency: 0, pass: false };
          setErr((e as Error).message);
        }
        setGrid({ ...next });
      }
    }
    setBusy(false);
    refreshRuns();
  };

  let scenarios: Scenario[] = [];
  try {
    scenarios = JSON.parse(suite);
  } catch {
    /* surfaced when they run it */
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-10 px-8 py-7">
        <section className="space-y-4">
          <SectionTitle>Which way requests go</SectionTitle>
          {runs.length === 0 ? (
            <p className="text-ui text-text-dim">
              Nothing recorded yet. Run the workflow a few times in Debug and
              the paths will show up here.
            </p>
          ) : (
            <>
              <p className="text-meta text-text-dim">
                {runs.length} run{runs.length > 1 ? "s" : ""}. Band thickness is
                how many went that way.
              </p>
              <Sankey runs={runs} />
            </>
          )}
        </section>

        {runs.length > 0 && (
          <section className="space-y-4">
            <SectionTitle>Cost and latency by node</SectionTitle>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Node</th>
                  <th className={thNum}>Visits</th>
                  <th className={thNum}>Avg latency</th>
                  <th className={thNum}>Avg cost</th>
                  <th className={thNum}>Total cost</th>
                  <th className={thNum}>Failures</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats).map(([id, s]) => (
                  <tr key={id} className="border-b border-line/60">
                    <td className={`${td} font-mono text-meta`}>{id}</td>
                    <td className={tdNum}>{s.visits}</td>
                    <td
                      className={tdNum}
                      style={{
                        color: `color-mix(in oklab, #fb7185 ${((s.avgLatencyMs ?? 0) / slowest) * 100}%, #8794a8)`,
                      }}
                    >
                      {ms(s.avgLatencyMs)}
                    </td>
                    <td className={tdNum}>{usd(s.avgCostUsd)}</td>
                    <td className={tdNum}>{usd(s.totalCostUsd)}</td>
                    <td className={`${tdNum} ${s.errors ? "text-halt" : ""}`}>
                      {s.errors || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="space-y-4">
          <SectionTitle
            aside={
              <button className={button} onClick={snapshot}>
                Save this version
              </button>
            }
          >
            Compare two versions
          </SectionTitle>

          {versions.length < 2 ? (
            <p className="text-ui text-text-dim">
              Save the graph as a version, change something, then save again.
              You can run both against the same scenarios and see what moved.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              {(
                [
                  ["A", a, setA],
                  ["B", b, setB],
                ] as const
              ).map(([tag, value, setValue]) => (
                <Field key={tag} label={`Version ${tag}`}>
                  <select
                    className={control}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                  >
                    {versions.map((v, i) => (
                      <option key={i} value={i}>
                        v{v.version} {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
              <button className={button} onClick={compare} disabled={busy}>
                {busy ? "Running…" : "Run both"}
              </button>
            </div>
          )}

          <Field label="Scenarios" hint="name, input, and any expected keys">
            <textarea
              className={`${control} h-40 font-mono text-meta`}
              value={suite}
              onChange={(e) => setSuite(e.target.value)}
            />
          </Field>

          {err && (
            <div className="rounded-md border border-halt/40 bg-halt/10 px-3 py-2 text-meta text-halt">
              {err}
            </div>
          )}

          {Object.keys(grid).length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Scenario</th>
                  <th className={thNum}>A cost</th>
                  <th className={thNum}>A time</th>
                  <th className={thNum}>A result</th>
                  <th className={thNum}>B cost</th>
                  <th className={thNum}>B time</th>
                  <th className={thNum}>B result</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.name} className="border-b border-line/60">
                    <td className={td}>{s.name}</td>
                    {[grid[`0:${s.name}`], grid[`1:${s.name}`]].map((c, i) => (
                      <Fragment key={i}>
                        <td className={tdNum}>{usd(c?.cost)}</td>
                        <td className={tdNum}>{ms(c?.latency)}</td>
                        <td
                          className={`${tdNum} ${c?.pass === false ? "text-halt" : c?.pass ? "text-live" : ""}`}
                          title={JSON.stringify(c?.result?.state, null, 2)}
                        >
                          {c?.pass === undefined
                            ? "review"
                            : c.pass
                              ? "matched"
                              : "missed"}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
