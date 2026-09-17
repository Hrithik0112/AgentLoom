import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
} from "../../packages/engine/index.ts";

/**
 * Browser-side LLM client. The key stays in this tab and goes nowhere but Anthropic.
 * When the engine moves to a server, this is the only file that changes.
 */
export class BrowserLLM implements LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const res = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return {
      text,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  }
}
