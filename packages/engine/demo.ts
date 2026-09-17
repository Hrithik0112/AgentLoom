/**
 * Engine self-check. Run with: npm run check
 * These asserts are the whole test suite. If the engine logic breaks, one of them fails.
 */
import assert from 'node:assert/strict'
import { FakeLLM } from './fake-llm.ts'
import { execute, replayFrom, run } from './runner.ts'
import type { Graph, RunContext } from './types.ts'

const supportAgent: Graph = {
  name: 'support triage',
  entry: 'start',
  nodes: [
    { id: 'start', type: 'input', config: {} },
    {
      id: 'classify',
      type: 'llm',
      config: { prompt: 'Classify this ticket: {{ ticket }}', outputKey: 'intent' },
    },
    {
      id: 'route',
      type: 'condition',
      config: { branches: [{ handle: 'billing', expr: "intent === 'billing'" }] },
    },
    { id: 'refund', type: 'llm', config: { prompt: 'Draft a refund reply for {{ ticket }}', outputKey: 'reply' } },
    { id: 'techfix', type: 'llm', config: { prompt: 'Draft a tech reply for {{ ticket }}', outputKey: 'reply' } },
    { id: 'end', type: 'output', config: {} },
  ],
  edges: [
    { from: 'start', to: 'classify' },
    { from: 'classify', to: 'route' },
    { from: 'route', to: 'refund', handle: 'billing' },
    { from: 'route', to: 'techfix', handle: 'else' },
    { from: 'refund', to: 'end' },
    { from: 'techfix', to: 'end' },
  ],
}

const fakeLlm = () =>
  new FakeLLM([
    ['Classify', 'billing'],
    ['refund reply', 'Here is your refund.'],
    ['tech reply', 'Try turning it off and on.'],
  ])

const ctxWith = (llm: FakeLLM): RunContext => ({ llm });

// 1. Branch routing follows the handle the condition picked.
{
  const llm = fakeLlm()
  const res = await run(supportAgent, { ticket: 'charged twice' }, ctxWith(llm))
  assert.equal(res.status, 'done')
  assert.equal(res.state.intent, 'billing')
  assert.equal(res.state.reply, 'Here is your refund.')
  assert.deepEqual(
    res.steps.map((s) => s.nodeId),
    ['start', 'classify', 'route', 'refund', 'end'],
  )
  assert.ok(res.steps[1].meta!.costUsd! > 0, 'llm step records a cost')
  assert.equal(res.steps[1].meta?.prompt, 'Classify this ticket: charged twice', 'records the rendered prompt')
}

// 2. The step cap fires on a cycle that never exits, instead of looping forever.
{
  const runaway: Graph = {
    entry: 'a',
    maxSteps: 12,
    nodes: [
      { id: 'a', type: 'input', config: {} },
      { id: 'b', type: 'condition', config: { branches: [{ handle: 'loop', expr: 'true' }] } },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'b', handle: 'loop' },
    ],
  }
  const res = await run(runaway, {}, ctxWith(fakeLlm()))
  assert.equal(res.status, 'halted')
  assert.equal(res.steps.length, 13, 'halts one step past the cap, with a halted event')
  assert.match(res.steps.at(-1)!.meta!.error!, /Step cap/)
}

// 3. Rewind to step N and replay unchanged reproduces the original run exactly.
{
  const first = await run(supportAgent, { ticket: 'charged twice' }, ctxWith(fakeLlm()))
  const llm = fakeLlm()
  const gen = replayFrom(first, 2, ctxWith(llm), supportAgent)
  let r = await gen.next()
  while (!r.done) r = await gen.next()
  assert.equal(r.value.state.reply, first.state.reply)
  assert.deepEqual(
    r.value.steps.map((s) => s.nodeId),
    ['route', 'refund', 'end'],
    'replay resumes at the rewind point, it does not restart',
  )
}

// 4. Replaying with an edited snapshot takes the other branch and re-pays nothing upstream.
{
  const first = await run(supportAgent, { ticket: 'charged twice' }, ctxWith(fakeLlm()))
  const llm = fakeLlm()
  const gen = replayFrom(first, 2, ctxWith(llm), supportAgent, { intent: 'technical' })
  let r = await gen.next()
  while (!r.done) r = await gen.next()
  assert.equal(r.value.state.reply, 'Try turning it off and on.', 'the edit flipped the branch')
  assert.equal(llm.calls.length, 1, 'only the downstream llm ran')
  assert.ok(!llm.calls.some((c) => c.prompt.includes('Classify')), 'classify was never re-paid')
}

// 5. Pause mid-run, edit state through next(), resume. The branch changes.
{
  const llm = fakeLlm()
  const gen = execute(supportAgent, { ticket: 'charged twice' }, ctxWith(llm))
  let r = await gen.next()
  let edited = false
  while (!r.done) {
    // Breakpoint: stop on classify, rewrite its output, then let it run on.
    if (!edited && r.value.nodeId === 'classify') {
      edited = true
      r = await gen.next({ intent: 'technical' })
      continue
    }
    r = await gen.next()
  }
  assert.ok(edited, 'the breakpoint was hit')
  assert.equal(r.value.state.reply, 'Try turning it off and on.')
}

// 6. An approval node holds the run until the caller resumes it.
{
  const gated: Graph = {
    entry: 'gate',
    nodes: [
      { id: 'gate', type: 'approval', config: { message: 'Send this refund?' } },
      { id: 'end', type: 'output', config: {} },
    ],
    edges: [{ from: 'gate', to: 'end' }],
  }
  const gen = execute(gated, {}, ctxWith(fakeLlm()))
  const first = await gen.next()
  assert.equal(first.done, false)
  assert.equal(first.done === false ? first.value.status : null, 'awaiting-approval')
  const after = await gen.next({ approved: true })
  assert.equal(after.done, false)
  const last = await gen.next()
  assert.equal(last.done, true)
}

// 7. A loop node walks an array and exits through the `done` handle.
{
  const looper: Graph = {
    entry: 'seed',
    nodes: [
      { id: 'seed', type: 'input', config: { seed: { docs: ['a', 'b', 'c'] } } },
      { id: 'each', type: 'loop', config: { over: 'docs', itemKey: 'doc' } },
      { id: 'note', type: 'tool', config: { kind: 'js', code: 'noop', outputKey: 'last' } },
      { id: 'end', type: 'output', config: {} },
    ],
    edges: [
      { from: 'seed', to: 'each' },
      { from: 'each', to: 'note', handle: 'body' },
      { from: 'each', to: 'end', handle: 'done' },
      { from: 'note', to: 'each' },
    ],
  }
  const visited: unknown[] = []
  const res = await run(looper, {}, {
    llm: fakeLlm(),
    tools: {
      run: async (_code, state) => {
        visited.push(state.doc)
        return state.doc
      },
    },
  })
  assert.equal(res.status, 'done')
  assert.deepEqual(visited, ['a', 'b', 'c'])
}

// 8. A node that throws ends the run as an error, with the message on the step.
{
  const broken: Graph = {
    entry: 'boom',
    nodes: [{ id: 'boom', type: 'condition', config: { branches: [{ handle: 'x', expr: 'this is not js' }] } }],
    edges: [],
  }
  const res = await run(broken, {}, ctxWith(fakeLlm()))
  assert.equal(res.status, 'error')
  assert.match(res.steps[0].meta!.error!, /Bad expression/)
}

console.log('engine ok, 8 checks passed')
