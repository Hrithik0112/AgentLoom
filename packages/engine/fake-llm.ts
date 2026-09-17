import type { LLMClient, LLMRequest, LLMResponse } from './types.ts'

/**
 * Canned client for tests and offline demos. `replies` is matched by substring against
 * the rendered prompt; the first hit wins, otherwise `fallback` is returned.
 */
export class FakeLLM implements LLMClient {
  calls: LLMRequest[] = []

  constructor(
    private replies: Array<[match: string, reply: string]> = [],
    private fallback = 'ok',
  ) {}

  async complete(req: LLMRequest): Promise<LLMResponse> {
    this.calls.push(req)
    const hit = this.replies.find(([match]) => req.prompt.includes(match))
    const text = hit ? hit[1] : this.fallback
    return { text, inputTokens: req.prompt.length / 4, outputTokens: text.length / 4 }
  }
}
