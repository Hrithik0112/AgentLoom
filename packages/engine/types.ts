/** The single JSON object that flows through the whole graph. */
export type State = Record<string, unknown>

export type NodeType = 'input' | 'llm' | 'tool' | 'condition' | 'loop' | 'approval' | 'output'

export type LlmConfig = {
  prompt: string
  system?: string
  model?: string
  maxTokens?: number
  outputKey: string
}

export type ToolConfig =
  | { kind: 'http'; url: string; method?: string; body?: string; outputKey: string }
  | { kind: 'js'; code: string; outputKey: string }

/** Evaluated in order; first truthy expr wins. No match falls through to the `else` handle. */
export type Branch = { handle: string; expr: string }

export type LoopConfig = {
  /** dot-path to an array in state */
  over?: string
  /** expression; loops while truthy */
  while?: string
  itemKey?: string
  indexKey?: string
  maxIterations?: number
}

export type AgentNode =
  | { id: string; type: 'input'; label?: string; config: { seed?: State } }
  | { id: string; type: 'llm'; label?: string; config: LlmConfig }
  | { id: string; type: 'tool'; label?: string; config: ToolConfig }
  | { id: string; type: 'condition'; label?: string; config: { branches: Branch[] } }
  | { id: string; type: 'loop'; label?: string; config: LoopConfig }
  | { id: string; type: 'approval'; label?: string; config: { message?: string } }
  | { id: string; type: 'output'; label?: string; config: { resultKey?: string } }

export type Edge = { from: string; to: string; handle?: string }

export type Graph = {
  id?: string
  name?: string
  version?: number
  nodes: AgentNode[]
  edges: Edge[]
  entry: string
  maxSteps?: number
}

export type StepMeta = {
  /** fully rendered, post-interpolation. Exactly what went over the wire */
  prompt?: string
  system?: string
  model?: string
  response?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  latencyMs?: number
  error?: string
}

export type StepStatus = 'ok' | 'error' | 'awaiting-approval' | 'done' | 'halted'

export type StepEvent = {
  step: number
  nodeId: string
  nodeType: NodeType
  label?: string
  status: StepStatus
  stateBefore: State
  stateAfter: State
  patch: State
  /** branch handle this node chose, if any */
  handle?: string
  /** next node id, or null when the run ends here */
  next: string | null
  meta?: StepMeta
}

export type RunResult = {
  state: State
  steps: StepEvent[]
  /** snapshots[i] is the state as it was BEFORE step i. These are the rewind targets */
  snapshots: State[]
  status: 'done' | 'error' | 'halted' | 'awaiting-approval'
  error?: string
}

export type LLMRequest = {
  model: string
  prompt: string
  system?: string
  maxTokens?: number
}

export type LLMResponse = {
  text: string
  inputTokens?: number
  outputTokens?: number
}

export interface LLMClient {
  complete(req: LLMRequest): Promise<LLMResponse>
}

/** Runs user-authored JS for `tool` nodes. The app layer supplies a Web Worker backed one. */
export interface ToolRunner {
  run(code: string, state: State): Promise<unknown>
}

export type RunContext = {
  llm: LLMClient
  tools?: ToolRunner
  /** overrides globalThis.fetch, mostly for tests */
  fetch?: typeof fetch
}

export type RunOptions = {
  /** start here instead of graph.entry. Used by rewind */
  startNode?: string
  /** seed state, used by rewind/replay */
  initialState?: State
  maxSteps?: number
}
