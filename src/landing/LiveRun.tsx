import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { execute, FakeLLM, type Graph, type StepEvent } from '../../packages/engine/index.ts'

/**
 * The hero is not a screenshot or a video. It is the real engine from packages/engine
 * running a real graph in the visitor's browser, one step at a time. The engine has no
 * dependencies and never touches the DOM, which is the only reason this is affordable
 * on a landing page.
 */

const GRAPH: Graph = {
  name: 'Support triage',
  entry: 'start',
  nodes: [
    { id: 'start', type: 'input', label: 'ticket in', config: {} },
    {
      id: 'classify',
      type: 'llm',
      label: 'classify intent',
      config: {
        prompt: 'Classify this support ticket as exactly one word.\n\nTicket: {{ ticket }}',
        outputKey: 'intent',
        model: 'claude-opus-5',
      },
    },
    {
      id: 'route',
      type: 'condition',
      label: 'route',
      config: {
        branches: [
          { handle: 'billing', expr: "intent === 'billing'" },
          { handle: 'technical', expr: "intent === 'technical'" },
        ],
      },
    },
    {
      id: 'refund',
      type: 'llm',
      label: 'billing reply',
      config: { prompt: 'Write a billing reply to: {{ ticket }}', outputKey: 'reply' },
    },
    {
      id: 'techfix',
      type: 'llm',
      label: 'technical reply',
      config: { prompt: 'Write a troubleshooting reply to: {{ ticket }}', outputKey: 'reply' },
    },
    { id: 'escalate', type: 'approval', label: 'human gate', config: { message: 'Send to a person?' } },
    { id: 'end', type: 'output', label: 'reply out', config: {} },
  ],
  edges: [
    { from: 'start', to: 'classify' },
    { from: 'classify', to: 'route' },
    { from: 'route', to: 'refund', handle: 'billing' },
    { from: 'route', to: 'techfix', handle: 'technical' },
    { from: 'route', to: 'escalate', handle: 'else' },
    { from: 'refund', to: 'end' },
    { from: 'techfix', to: 'end' },
    { from: 'escalate', to: 'end' },
  ],
}

/** Two tickets so the run takes a visibly different path each time through the loop. */
const TICKETS = [
  { ticket: 'I was charged twice this month', intent: 'billing' },
  { ticket: 'The app crashes when I open settings', intent: 'technical' },
]

const llmFor = (intent: string) =>
  new FakeLLM([
    ['Classify', intent],
    ['billing reply', 'Sorry about the double charge. The duplicate is refunded.'],
    ['troubleshooting', 'Clear the app cache, then reopen settings.'],
  ])

const POS: Record<string, { x: number; y: number }> = {
  start: { x: 8, y: 116 },
  classify: { x: 146, y: 116 },
  route: { x: 284, y: 116 },
  refund: { x: 438, y: 30 },
  techfix: { x: 438, y: 116 },
  escalate: { x: 438, y: 202 },
  end: { x: 576, y: 116 },
}

const W = 124
const H = 40
const VIEW_W = 708
const VIEW_H = 262

const TYPE_COLOR: Record<string, string> = {
  input: '#38bdf8',
  llm: '#a78bfa',
  condition: '#4ade80',
  approval: '#fb7185',
  output: '#94a3b8',
}

const edgePath = (from: string, to: string) => {
  const a = POS[from]
  const b = POS[to]
  const x1 = a.x + W
  const y1 = a.y + H / 2
  const x2 = b.x
  const y2 = b.y + H / 2
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))

export function LiveRun() {
  const [steps, setSteps] = useState<StepEvent[]>([])
  const [pass, setPass] = useState(0)
  const [paused, setPaused] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const reducedMotion = useMemo(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  useEffect(() => {
    let cancelled = false
    const scenario = TICKETS[pass % TICKETS.length]

    const play = async () => {
      const gen = execute(GRAPH, { ticket: scenario.ticket }, { llm: llmFor(scenario.intent) })
      const collected: StepEvent[] = []
      let res = await gen.next()
      while (!res.done) {
        collected.push(res.value)
        res = await gen.next()
      }
      if (cancelled) return

      // Reduced motion gets the finished run with no stepping animation at all.
      if (reducedMotion) return setSteps(collected)

      setSteps([])
      collected.forEach((step, i) => {
        timers.current.push(
          setTimeout(() => {
            if (!cancelled) setSteps(collected.slice(0, i + 1))
          }, 260 + i * 900),
        )
      })
      timers.current.push(
        setTimeout(
          () => {
            if (!cancelled) setPass((p) => p + 1)
          },
          260 + collected.length * 900 + 2600,
        ),
      )
    }

    if (!paused) play()
    return () => {
      cancelled = true
      clearTimers()
    }
  }, [pass, paused, reducedMotion, clearTimers])

  const current = steps.at(-1)
  const visited = new Set(steps.map((s) => s.nodeId))
  const traversed = new Set(steps.slice(1).map((s, i) => `${steps[i].nodeId}->${s.nodeId}`))
  const cost = steps.reduce((sum, s) => sum + (s.meta?.costUsd ?? 0), 0)

  const changed = current
    ? Object.keys(current.patch).filter((k) => show(current.stateBefore[k]) !== show(current.stateAfter[k]))
    : []

  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-line bg-ink-800">
      <figcaption className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <span className="relative flex h-2 w-2">
          {!paused && !reducedMotion && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
        </span>
        <span className="text-meta text-text-dim">
          Running in this tab, right now. No video, no mockup.
        </span>
        <button
          onClick={() => setPaused((p) => !p)}
          className="ml-auto rounded-md px-2 py-0.5 text-meta text-text-faint transition-colors hover:text-text"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </figcaption>

      <div className="grid gap-px bg-line lg:grid-cols-[1.35fr_1fr]">
        <div className="flex items-center bg-ink-900 p-4">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" role="img" aria-label="Workflow graph">
            {GRAPH.edges.map((e) => {
              const hot = traversed.has(`${e.from}->${e.to}`)
              return (
                <path
                  key={`${e.from}-${e.handle ?? ''}-${e.to}`}
                  d={edgePath(e.from, e.to)}
                  fill="none"
                  stroke={hot ? 'var(--color-live)' : 'var(--color-line-bright)'}
                  strokeWidth={hot ? 2 : 1.25}
                  className="transition-all duration-300"
                />
              )
            })}

            {GRAPH.nodes.map((n) => {
              const p = POS[n.id]
              const isNow = current?.nodeId === n.id
              const seen = visited.has(n.id)
              return (
                <g key={n.id} className="transition-opacity duration-300" opacity={seen || isNow ? 1 : 0.45}>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={W}
                    height={H}
                    rx={7}
                    fill="var(--color-ink-700)"
                    stroke={isNow ? 'var(--color-live)' : seen ? 'var(--color-line-bright)' : 'var(--color-line)'}
                    strokeWidth={isNow ? 2 : 1}
                  />
                  <circle cx={p.x + 13} cy={p.y + H / 2} r={3.5} fill={TYPE_COLOR[n.type]} />
                  <text
                    x={p.x + 24}
                    y={p.y + H / 2}
                    dy="0.36em"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    fill={isNow ? 'var(--color-text)' : 'var(--color-text-dim)'}
                  >
                    {n.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="flex flex-col bg-ink-800">
          <ol className="m-0 list-none p-0">
            {GRAPH.nodes.slice(0, 5).map((_, i) => {
              const s = steps[i]
              return (
                <li
                  key={i}
                  className={`flex h-9 items-center gap-2.5 px-4 text-ui transition-colors ${
                    s && i === steps.length - 1 ? 'bg-ink-600 text-text' : 'text-text-dim'
                  }`}
                >
                  <span className="tnum w-4 text-right font-mono text-micro text-text-faint">{i}</span>
                  {s ? (
                    <>
                      <span className="flex-1 truncate">{s.label}</span>
                      {s.handle && <span className="font-mono text-micro text-live">{s.handle}</span>}
                    </>
                  ) : (
                    <span className="h-px flex-1 bg-line" />
                  )}
                </li>
              )
            })}
          </ol>

          <div className="min-h-[124px] border-t border-line p-4">
            {current && changed.length > 0 ? (
              <div className="space-y-1.5">
                <p className="m-0 text-meta text-text-faint">
                  {current.label} wrote <span className="font-mono text-text-dim">{changed.join(', ')}</span>
                </p>
                {changed.map((k) => (
                  <p
                    key={k}
                    className="m-0 line-clamp-3 rounded-md border-l-2 border-live/60 bg-live/10 px-2.5 py-1.5 font-mono text-meta text-emerald-200"
                  >
                    {show(current.stateAfter[k])}
                  </p>
                ))}
              </div>
            ) : (
              <p className="m-0 text-meta text-text-faint">
                {current ? `${current.label} changed nothing.` : 'Waiting for the first step.'}
              </p>
            )}
          </div>

          <div className="tnum mt-auto flex items-center gap-4 border-t border-line px-4 py-2.5 font-mono text-micro text-text-faint">
            <span>{steps.length} steps</span>
            <span>${cost.toFixed(4)}</span>
            <span className="ml-auto text-text-dim">{TICKETS[pass % TICKETS.length].intent} path</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
