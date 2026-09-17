import type { LoomDoc } from './lib/graph.ts'

const node = (id: string, type: string, x: number, y: number, config: Record<string, unknown>, label?: string) => ({
  id,
  type: 'loom',
  position: { x, y },
  data: { type, label: label ?? id, config },
})

const edge = (from: string, to: string, handle?: string) => ({
  id: `${from}-${handle ?? ''}-${to}`,
  source: from,
  target: to,
  sourceHandle: handle,
  label: handle,
})

const supportTriage: LoomDoc = {
  name: 'Support triage',
  version: 1,
  nodes: [
    node('start', 'input', 40, 200, { seed: {} }, 'ticket in'),
    node('classify', 'llm', 260, 200, {
      prompt:
        'Classify this support ticket as exactly one word, billing, technical, or other.\n\nTicket: {{ ticket }}',
      outputKey: 'intent',
      model: 'claude-opus-5',
      maxTokens: 16,
    }, 'classify intent'),
    node('route', 'condition', 500, 200, {
      branches: [
        { handle: 'billing', expr: "intent.includes('billing')" },
        { handle: 'technical', expr: "intent.includes('technical')" },
      ],
    }, 'route'),
    node('refund', 'llm', 740, 80, {
      prompt: 'Write a short, warm billing reply to: {{ ticket }}',
      outputKey: 'reply',
    }, 'billing reply'),
    node('techfix', 'llm', 740, 220, {
      prompt: 'Write a short troubleshooting reply to: {{ ticket }}',
      outputKey: 'reply',
    }, 'technical reply'),
    node('escalate', 'approval', 740, 360, { message: 'No clear intent. Send to a human?' }, 'human gate'),
    node('end', 'output', 990, 200, {}, 'reply out'),
  ] as LoomDoc['nodes'],
  edges: [
    edge('start', 'classify'),
    edge('classify', 'route'),
    edge('route', 'refund', 'billing'),
    edge('route', 'techfix', 'technical'),
    edge('route', 'escalate', 'else'),
    edge('refund', 'end'),
    edge('techfix', 'end'),
    edge('escalate', 'end'),
  ],
}

const researchLoop: LoomDoc = {
  name: 'Research loop',
  version: 1,
  nodes: [
    node('start', 'input', 40, 180, { seed: { notes: [] } }, 'topics in'),
    node('each', 'loop', 260, 180, { over: 'topics', itemKey: 'topic' }, 'for each topic'),
    node('dig', 'llm', 500, 100, {
      prompt: 'Give me three concrete facts about: {{ topic }}',
      outputKey: 'fact',
    }, 'research'),
    node('collect', 'tool', 740, 100, {
      kind: 'js',
      code: 'return [...(state.notes ?? []), { topic: state.topic, fact: state.fact }]',
      outputKey: 'notes',
    }, 'collect'),
    node('summary', 'llm', 500, 300, {
      prompt: 'Summarize these research notes into one paragraph:\n\n{{ notes }}',
      outputKey: 'summary',
    }, 'summarize'),
    node('end', 'output', 740, 300, {}, 'summary out'),
  ] as LoomDoc['nodes'],
  edges: [
    edge('start', 'each'),
    edge('each', 'dig', 'body'),
    edge('dig', 'collect'),
    edge('collect', 'each'),
    edge('each', 'summary', 'done'),
    edge('summary', 'end'),
  ],
}

export const EXAMPLES: { name: string; input: string; doc: LoomDoc }[] = [
  {
    name: 'Support triage',
    input: '{\n  "ticket": "I was charged twice this month"\n}',
    doc: supportTriage,
  },
  {
    name: 'Research loop',
    input: '{\n  "topics": ["tardigrades", "the Antikythera mechanism"]\n}',
    doc: researchLoop,
  },
]
