/** USD per 1M tokens. Source: Anthropic list pricing. */
const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5': { in: 10, out: 50 },
}

export const MODELS = Object.keys(PRICES)

export const DEFAULT_MODEL = 'claude-opus-5'

export function costUsd(model: string, inputTokens = 0, outputTokens = 0): number | undefined {
  const p = PRICES[model]
  if (!p) return undefined
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000
}
