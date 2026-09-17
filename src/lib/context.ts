import type { RunContext } from "../../packages/engine/index.ts";
import { BrowserLLM } from "./anthropic.ts";
import { demoLLM } from "./demo-llm.ts";
import { WorkerToolRunner } from "./tool-worker.ts";

const tools = new WorkerToolRunner();

/** The one place a run gets wired to the outside world. No key means the canned demo client. */
export const runContext = (apiKey: string): RunContext => ({
  llm: apiKey ? new BrowserLLM(apiKey) : demoLLM(),
  tools,
});
