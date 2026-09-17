import type { State } from './types.ts'

/** Reads a dot-path out of state. `get({a:{b:1}}, 'a.b')` -> 1 */
export function get(state: State, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return (acc as Record<string, unknown>)[key]
  }, state)
}

const stringify = (v: unknown) =>
  v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 2)

/** Fills `{{ path }}` holes in a template from state. */
export function render(template: string, state: State): string {
  return template.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (_, path: string) => stringify(get(state, path)))
}

/**
 * Evaluates a condition expression against state. Expressions are authored by the
 * workflow's own owner, so they run at the same trust level as the page.
 * User-supplied *tool* code is different. That goes through ToolRunner (a Worker).
 */
export function evalExpr(expr: string, state: State): unknown {
  try {
    // `with` needs sloppy mode, which is why there is no "use strict" here. It is what lets
    // expressions read state fields bare (`intent === 'billing'`) instead of `state.intent`.
    const fn = new Function('state', `with (state) { return (${expr}); }`)
    return fn(state)
  } catch (e) {
    throw new Error(`Bad expression ${JSON.stringify(expr)}: ${(e as Error).message}`)
  }
}
