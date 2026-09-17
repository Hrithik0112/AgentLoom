import { useEffect, useState } from 'react'
import type { State, StepEvent } from '../../packages/engine/index.ts'
import { ms, usd } from '../lib/stats.ts'
import { useStore } from '../store.ts'

const btn =
  'rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs hover:border-zinc-500 disabled:opacity-40 disabled:hover:border-zinc-700'

const show = (v: unknown) =>
  typeof v === 'string' ? v : JSON.stringify(v, null, 2)

/** What this step changed. The diff is the question you are actually asking, not the dump. */
function Diff({ step }: { step: StepEvent }) {
  const keys = [...new Set([...Object.keys(step.stateBefore), ...Object.keys(step.stateAfter)])]
  const changed = keys.filter((k) => show(step.stateBefore[k]) !== show(step.stateAfter[k]))
  if (!changed.length) return <p className="text-xs text-zinc-600">No state change.</p>
  return (
    <div className="space-y-2">
      {changed.map((k) => (
        <div key={k} className="font-mono text-[11px]">
          <div className="text-zinc-500">{k}</div>
          {k in step.stateBefore && (
            <div className="whitespace-pre-wrap break-words rounded bg-red-950/40 px-2 py-1 text-red-300">
              - {show(step.stateBefore[k])}
            </div>
          )}
          <div className="whitespace-pre-wrap break-words rounded bg-emerald-950/40 px-2 py-1 text-emerald-300">
            + {show(step.stateAfter[k])}
          </div>
        </div>
      ))}
    </div>
  )
}

function Inspector({ step }: { step: StepEvent }) {
  const [tab, setTab] = useState<'diff' | 'state' | 'prompt'>('diff')
  const rewindTo = useStore((s) => s.rewindTo)
  const [edit, setEdit] = useState('')

  useEffect(() => setTab('diff'), [step.step])

  return (
    <div className="space-y-3 border-t border-zinc-800 p-3">
      <div className="flex gap-1">
        {(['diff', 'state', 'prompt'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-2 py-0.5 text-xs ${tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-zinc-500">
          {ms(step.meta?.latencyMs)} {usd(step.meta?.costUsd)}
        </span>
      </div>

      {step.meta?.error && (
        <div className="rounded bg-red-950/50 px-2 py-1 font-mono text-[11px] text-red-300">{step.meta.error}</div>
      )}

      {tab === 'diff' && <Diff step={step} />}

      {tab === 'state' && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-300">
          {JSON.stringify(step.stateAfter, null, 2)}
        </pre>
      )}

      {tab === 'prompt' &&
        (step.meta?.prompt ? (
          <div className="space-y-2">
            {step.meta.system && (
              <>
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">system</div>
                <pre className="whitespace-pre-wrap break-words rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-400">
                  {step.meta.system}
                </pre>
              </>
            )}
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              prompt sent ({step.meta.model})
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-900 p-2 font-mono text-[11px] text-sky-200">
              {step.meta.prompt}
            </pre>
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">response</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-900 p-2 font-mono text-[11px] text-violet-200">
              {step.meta.response}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-zinc-600">Not a model call.</p>
        ))}

      <div className="space-y-1 border-t border-zinc-800 pt-3">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">replay from here with a change</div>
        <textarea
          className="h-16 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] outline-none focus:border-sky-500"
          placeholder='{ "intent": "technical" }'
          value={edit}
          onChange={(e) => setEdit(e.target.value)}
        />
        <button
          className={btn}
          onClick={() => {
            let patch: State = {}
            try {
              patch = edit.trim() ? JSON.parse(edit) : {}
            } catch {
              return
            }
            rewindTo(step.step, patch)
          }}
        >
          rewind to step {step.step}
        </button>
      </div>
    </div>
  )
}

export function DebugPanel() {
  const {
    status,
    steps,
    currentStep,
    error,
    input,
    setInput,
    start,
    stepOnce,
    resume,
    stop,
    inspect,
    editState,
    breakpoints,
  } = useStore()

  const running = status === 'running'
  const live = status === 'paused' || status === 'awaiting-approval'
  const selected = currentStep !== null ? steps[currentStep] : undefined
  const totalCost = steps.reduce((sum, s) => sum + (s.meta?.costUsd ?? 0), 0)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-2 p-3">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">initial state (JSON)</div>
        <textarea
          className="h-20 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] outline-none focus:border-sky-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <button className={btn} onClick={start} disabled={running}>
            run
          </button>
          <button className={btn} onClick={stepOnce} disabled={running}>
            step
          </button>
          <button className={btn} onClick={resume} disabled={!live}>
            resume
          </button>
          <button className={btn} onClick={stop} disabled={status === 'idle'}>
            stop
          </button>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span
            className={
              status === 'error' || status === 'halted'
                ? 'text-red-400'
                : status === 'running'
                  ? 'text-amber-400'
                  : status === 'done'
                    ? 'text-emerald-400'
                    : 'text-zinc-400'
            }
          >
            {status}
          </span>
          <span className="text-zinc-600">
            {steps.length} steps / {usd(totalCost)}
          </span>
          {breakpoints.length > 0 && <span className="text-red-400">{breakpoints.length} bp</span>}
        </div>
        {error && <div className="rounded bg-red-950/50 px-2 py-1 font-mono text-[11px] text-red-300">{error}</div>}

        {status === 'awaiting-approval' && (
          <div className="space-y-1 rounded border border-rose-900 bg-rose-950/40 p-2">
            <div className="text-xs text-rose-200">{selected?.meta?.response ?? 'Waiting for approval'}</div>
            <div className="flex gap-1">
              <button
                className={btn}
                onClick={() => {
                  editState({ approved: true })
                  resume()
                }}
              >
                approve
              </button>
              <button
                className={btn}
                onClick={() => {
                  editState({ approved: false })
                  resume()
                }}
              >
                reject
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800">
        {steps.map((s) => (
          <button
            key={s.step}
            onClick={() => inspect(s.step)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-zinc-900 ${
              currentStep === s.step ? 'bg-zinc-800' : ''
            }`}
          >
            <span className="w-5 text-right font-mono text-[10px] text-zinc-600">{s.step}</span>
            <span className="flex-1 truncate">{s.label ?? s.nodeId}</span>
            {s.handle && <span className="font-mono text-[10px] text-emerald-400">{s.handle}</span>}
            {s.status === 'error' && <span className="text-[10px] text-red-400">err</span>}
          </button>
        ))}
      </div>

      {selected && <Inspector step={selected} />}
    </div>
  )
}
