import { evalExpr, get, render } from './expr.ts'
import { costUsd, DEFAULT_MODEL } from './pricing.ts'
import type { AgentNode, RunContext, State, StepMeta } from './types.ts'

export type NodeOutcome = {
  patch: State
  /** branch label the runner should follow out of this node */
  handle?: string
  meta?: StepMeta
  /** run ends here */
  terminal?: boolean
  /** hold for a human decision */
  pause?: boolean
}

export async function runNode(node: AgentNode, state: State, ctx: RunContext): Promise<NodeOutcome> {
  switch (node.type) {
    case 'input':
      return { patch: { ...node.config.seed } }

    case 'output':
      return { patch: {}, terminal: true }

    case 'approval':
      return { patch: {}, pause: true, meta: { response: node.config.message } }

    case 'llm': {
      const { prompt, system, outputKey, maxTokens } = node.config
      const model = node.config.model ?? DEFAULT_MODEL
      const rendered = render(prompt, state)
      const renderedSystem = system ? render(system, state) : undefined
      const started = Date.now()
      const res = await ctx.llm.complete({ model, prompt: rendered, system: renderedSystem, maxTokens })
      return {
        patch: { [outputKey]: res.text },
        meta: {
          prompt: rendered,
          system: renderedSystem,
          model,
          response: res.text,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          costUsd: costUsd(model, res.inputTokens, res.outputTokens),
          latencyMs: Date.now() - started,
        },
      }
    }

    case 'tool': {
      const started = Date.now()
      const cfg = node.config
      if (cfg.kind === 'js') {
        if (!ctx.tools) throw new Error(`Node ${node.id} needs a ToolRunner but none was provided`)
        const value = await ctx.tools.run(cfg.code, state)
        return { patch: { [cfg.outputKey]: value }, meta: { latencyMs: Date.now() - started } }
      }
      const doFetch = ctx.fetch ?? globalThis.fetch
      const url = render(cfg.url, state)
      const method = cfg.method ?? 'GET'
      const body = cfg.body ? render(cfg.body, state) : undefined
      const res = await doFetch(url, {
        method,
        body: method === 'GET' ? undefined : body,
        headers: body ? { 'content-type': 'application/json' } : undefined,
      })
      const text = await res.text()
      let value: unknown = text
      try {
        value = JSON.parse(text)
      } catch {
        /* not JSON, keep the raw text */
      }
      return {
        patch: { [cfg.outputKey]: value },
        meta: {
          latencyMs: Date.now() - started,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        },
      }
    }

    case 'condition': {
      for (const branch of node.config.branches) {
        if (evalExpr(branch.expr, state)) return { patch: {}, handle: branch.handle }
      }
      return { patch: {}, handle: 'else' }
    }

    case 'loop': {
      const cfg = node.config
      const indexKey = cfg.indexKey ?? `${node.id}__i`
      const next = ((get(state, indexKey) as number) ?? -1) + 1
      const cap = cfg.maxIterations ?? 100

      if (next >= cap) return { patch: { [indexKey]: next }, handle: 'done' }

      if (cfg.over) {
        const items = get(state, cfg.over)
        if (!Array.isArray(items)) throw new Error(`Loop ${node.id}: ${cfg.over} is not an array`)
        if (next >= items.length) return { patch: { [indexKey]: next }, handle: 'done' }
        const patch: State = { [indexKey]: next }
        if (cfg.itemKey) patch[cfg.itemKey] = items[next]
        return { patch, handle: 'body' }
      }

      if (cfg.while) {
        const patch: State = { [indexKey]: next }
        return { patch, handle: evalExpr(cfg.while, state) ? 'body' : 'done' }
      }

      throw new Error(`Loop ${node.id} needs either 'over' or 'while'`)
    }
  }
}
// ponytail: a loop's index lives in flat state, so the same loop node re-entered from an
// outer loop resumes where it left off. Nested loops need per-frame scoping. Add when asked.
