# AgentLoom

DevTools for AI agent workflows. Not another node palette: a visual environment for
understanding, debugging, and measuring agent pipelines.

```bash
npm install
npm run dev     # landing page at /, the debugger at /app.html
npm run check   # engine self-check, no browser, no API key
```

No API key needed to try it. Without one, runs execute against a canned client so every
branch in the bundled examples still works. Paste a key in the header to run for real; it
is stored in your browser and goes nowhere but `api.anthropic.com`.

## Three modes

**Build** wires up seven node types (input, llm, tool, condition, loop, approval, output).
Every node card shows what it reads, what it writes, and its measured cost and latency
from past runs.

**Debug** is the point of the project. Run a workflow and watch it execute node by node.
Set breakpoints. Inspect the state at every step, as a diff against the previous one. Edit
that state by hand and resume. Rewind to any earlier step and replay with a change, with
no upstream model calls re-paid. See the fully rendered prompt for every model call, post
interpolation, exactly what went over the wire.

**Analyze** aggregates across runs: a Sankey of which paths requests actually take, a
per-node latency and cost heatmap, and a scorecard comparing two saved graph versions on
the same test suite.

## Architecture

```
packages/engine/   pure TypeScript. No React, no DOM. Runs under plain node.
src/               Vite + React + React Flow. Imports the engine, never reimplements it.
src/landing/       the landing page, built as its own entry so visitors do not
                   download React Flow just to read the pitch.
```

The landing page hero is not a screenshot or a video. It imports `packages/engine`
and runs a real workflow in the visitor's browser, one step at a time, which is
affordable only because the engine has no dependencies and never touches the DOM.

The engine is an async generator:

```ts
async function* execute(graph, state, ctx): AsyncGenerator<StepEvent, RunResult, State>
```

The entire debugger falls out of that shape. Running is pulling steps in a loop; stepping
is pulling one; pausing is not pulling; editing state is passing a patch back through
`next()`. Snapshots taken before each step give rewind and replay.

The engine reaches the outside world only through an injected `LLMClient`, so moving
execution to a server later changes one file (`src/lib/anthropic.ts`) and nothing else.

## Not in v1

Code export, auth, a hosted backend, multi-user collaboration, LLM-as-judge scoring.
