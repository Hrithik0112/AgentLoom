import { runNode } from './nodes.ts'
import type { Graph, RunContext, RunOptions, RunResult, State, StepEvent } from './types.ts'

const DEFAULT_MAX_STEPS = 100

function resolveNext(graph: Graph, from: string, handle?: string): string | null {
  const out = graph.edges.filter((e) => e.from === from)
  if (handle !== undefined) {
    const match = out.find((e) => e.handle === handle)
    if (match) return match.to
  }
  const plain = out.find((e) => e.handle === undefined)
  return plain?.to ?? out[0]?.to ?? null
}

/**
 * The whole debugger lives on this generator.
 *
 *   run    = pull steps in a loop
 *   step   = pull exactly one
 *   pause  = stop pulling
 *   edit   = pass a state patch into next(), it merges before the following step
 *   rewind = start a fresh generator from snapshots[n] with startNode = steps[n].nodeId
 */
export async function* execute(
  graph: Graph,
  initialState: State,
  ctx: RunContext,
  opts: RunOptions = {},
): AsyncGenerator<StepEvent, RunResult, State | undefined> {
  const maxSteps = opts.maxSteps ?? graph.maxSteps ?? DEFAULT_MAX_STEPS
  const steps: StepEvent[] = []
  const snapshots: State[] = []
  let state: State = { ...initialState }
  let current: string | null = opts.startNode ?? graph.entry
  let step = 0

  const finish = (status: RunResult['status'], error?: string): RunResult => ({
    state,
    steps,
    snapshots,
    status,
    error,
  })

  while (current) {
    const node = graph.nodes.find((n) => n.id === current)
    if (!node) return finish('error', `No node with id ${current}`)

    if (step >= maxSteps) {
      const event: StepEvent = {
        step,
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        status: 'halted',
        stateBefore: state,
        stateAfter: state,
        patch: {},
        next: null,
        meta: { error: `Step cap of ${maxSteps} reached, the graph probably has a cycle that never exits` },
      }
      steps.push(event)
      yield event
      return finish('halted', event.meta!.error)
    }

    const stateBefore = { ...state }
    snapshots.push(stateBefore)

    let event: StepEvent
    try {
      const outcome = await runNode(node, state, ctx)
      state = { ...state, ...outcome.patch }
      event = {
        step,
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        status: outcome.pause ? 'awaiting-approval' : outcome.terminal ? 'done' : 'ok',
        stateBefore,
        stateAfter: state,
        patch: outcome.patch,
        handle: outcome.handle,
        next: outcome.terminal ? null : resolveNext(graph, node.id, outcome.handle),
        meta: outcome.meta,
      }
    } catch (e) {
      event = {
        step,
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        status: 'error',
        stateBefore,
        stateAfter: state,
        patch: {},
        next: null,
        meta: { error: (e as Error).message },
      }
    }

    steps.push(event)
    const edit = yield event

    // A state edit handed back through next() lands here, this is "modify and resume".
    if (edit) {
      state = { ...state, ...edit }
      event.stateAfter = state
      event.patch = { ...event.patch, ...edit }
    }

    if (event.status === 'error') return finish('error', event.meta?.error)

    step++
    current = event.next
  }

  return finish('done')
}

/** Drain the generator start to finish. Used by tests, batch runs, and the Analyze test suite. */
export async function run(
  graph: Graph,
  initialState: State,
  ctx: RunContext,
  opts: RunOptions = {},
): Promise<RunResult> {
  const gen = execute(graph, initialState, ctx, opts)
  let res = await gen.next()
  while (!res.done) res = await gen.next()
  return res.value
}

/**
 * Replay from a recorded step with the state optionally changed. Steps before `step`
 * are never re-executed, so their LLM calls are not paid for twice.
 */
export function replayFrom(
  prior: RunResult,
  step: number,
  ctx: RunContext,
  graph: Graph,
  edit: State = {},
): AsyncGenerator<StepEvent, RunResult, State | undefined> {
  const snapshot = prior.snapshots[step]
  if (!snapshot) throw new Error(`No snapshot for step ${step}`)
  return execute(graph, { ...snapshot, ...edit }, ctx, { startNode: prior.steps[step].nodeId })
}
