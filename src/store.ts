import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react'
import { create } from 'zustand'
import {
  execute,
  replayFrom,
  type NodeType,
  type RunResult,
  type State,
  type StepEvent,
} from '../packages/engine/index.ts'
import { runContext } from './lib/context.ts'
import { DEFAULT_CONFIG, toGraph, type LoomDoc, type LoomNode } from './lib/graph.ts'
import { loadApiKey, loadDoc, loadRuns, saveApiKey, saveDoc, saveRun, type RunRecord } from './lib/persist.ts'
import { EXAMPLES } from './examples.ts'

export type Mode = 'build' | 'debug' | 'analyze'
export type RunStatus = 'idle' | 'running' | 'paused' | 'awaiting-approval' | 'done' | 'error' | 'halted'

/** The live generator. Kept out of the store. It is not state, and it is not serializable. */
let gen: AsyncGenerator<StepEvent, RunResult, State | undefined> | null = null

type Store = {
  mode: Mode
  setMode: (mode: Mode) => void

  name: string
  version: number
  nodes: LoomNode[]
  edges: Edge[]
  selectedId: string | null

  apiKey: string
  setApiKey: (key: string) => void

  onNodesChange: (changes: NodeChange<LoomNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (conn: Connection) => void
  select: (id: string | null) => void
  addNode: (type: NodeType) => void
  updateNode: (id: string, patch: Partial<LoomNode['data']>) => void
  deleteNode: (id: string) => void
  loadDocument: (doc: LoomDoc) => void
  rename: (name: string) => void

  // debug
  input: string
  setInput: (v: string) => void
  steps: StepEvent[]
  currentStep: number | null
  status: RunStatus
  error: string | null
  breakpoints: string[]
  pendingEdit: State | null
  toggleBreakpoint: (id: string) => void
  start: () => Promise<void>
  stepOnce: () => Promise<void>
  resume: () => Promise<void>
  stop: () => void
  editState: (patch: State) => void
  rewindTo: (step: number, edit?: State) => Promise<void>
  inspect: (step: number) => void

  // analyze
  runs: RunRecord[]
  refreshRuns: () => Promise<void>
}

const saved = loadDoc()
const initial: LoomDoc = saved ?? EXAMPLES[0].doc

let nodeSeq = initial.nodes.length

export const useStore = create<Store>((set, get) => {
  const persist = () => {
    const { name, version, nodes, edges } = get()
    saveDoc({ name, version, nodes, edges })
  }

  const context = () => runContext(get().apiKey)

  const finish = async (result: RunResult) => {
    gen = null
    set({ status: result.status === 'done' ? 'done' : (result.status as RunStatus), error: result.error ?? null })
    const { name, version, steps } = get()
    await saveRun({
      id: crypto.randomUUID(),
      graphName: name,
      graphVersion: version,
      startedAt: Date.now(),
      status: result.status,
      steps,
      finalState: result.state,
    })
    await get().refreshRuns()
  }

  /** Pulls steps off the generator until a breakpoint, an approval gate, or the end. */
  const pump = async (once: boolean) => {
    if (!gen) return
    set({ status: 'running' })
    const active = gen
    while (gen === active) {
      const edit = get().pendingEdit
      if (edit) set({ pendingEdit: null })
      let res
      try {
        res = await active.next(edit ?? undefined)
      } catch (e) {
        gen = null
        set({ status: 'error', error: (e as Error).message })
        return
      }
      if (res.done) return finish(res.value)

      // Renumber against the timeline, not the generator: a replay starts its own count
      // at 0, and the timeline has to stay continuous across a rewind.
      const event = res.value
      set((s) => ({ steps: [...s.steps, { ...event, step: s.steps.length }], currentStep: s.steps.length }))

      if (event.status === 'awaiting-approval') return set({ status: 'awaiting-approval' })
      if (event.status === 'error') continue // the generator returns on the next pull
      if (once) return set({ status: 'paused' })
      if (event.next && get().breakpoints.includes(event.next)) return set({ status: 'paused' })
    }
  }

  const begin = (
    generator: AsyncGenerator<StepEvent, RunResult, State | undefined>,
    steps: StepEvent[] = [],
  ) => {
    gen = generator
    set({ steps, currentStep: null, error: null, pendingEdit: null, status: 'paused', mode: 'debug' })
  }

  return {
    mode: 'build',
    setMode: (mode) => set({ mode }),

    name: initial.name,
    version: initial.version,
    nodes: initial.nodes,
    edges: initial.edges,
    selectedId: null,

    apiKey: loadApiKey(),
    setApiKey: (key) => {
      saveApiKey(key)
      set({ apiKey: key })
    },

    onNodesChange: (changes) => {
      set({ nodes: applyNodeChanges(changes, get().nodes) })
      persist()
    },
    onEdgesChange: (changes) => {
      set({ edges: applyEdgeChanges(changes, get().edges) })
      persist()
    },
    onConnect: (conn) => {
      set({ edges: addEdge({ ...conn, label: conn.sourceHandle ?? undefined }, get().edges) })
      persist()
    },
    select: (selectedId) => set({ selectedId }),

    addNode: (type) => {
      const id = `${type}_${++nodeSeq}`
      const node: LoomNode = {
        id,
        type: 'loom',
        position: { x: 120 + (nodeSeq % 4) * 60, y: 80 + nodeSeq * 40 },
        data: { type, label: type, config: structuredClone(DEFAULT_CONFIG[type]) },
      }
      set({ nodes: [...get().nodes, node], selectedId: id })
      persist()
    },
    updateNode: (id, patch) => {
      set({
        nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      })
      persist()
    },
    deleteNode: (id) => {
      set({
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        selectedId: null,
      })
      persist()
    },
    loadDocument: (doc) => {
      nodeSeq = doc.nodes.length
      set({ ...doc, selectedId: null, steps: [], currentStep: null, status: 'idle', error: null })
      persist()
    },
    rename: (name) => {
      set({ name })
      persist()
    },

    input: '{\n  "ticket": "I was charged twice this month"\n}',
    setInput: (input) => set({ input }),
    steps: [],
    currentStep: null,
    status: 'idle',
    error: null,
    breakpoints: [],
    pendingEdit: null,

    toggleBreakpoint: (id) =>
      set((s) => ({
        breakpoints: s.breakpoints.includes(id) ? s.breakpoints.filter((b) => b !== id) : [...s.breakpoints, id],
      })),

    start: async () => {
      const { nodes, edges, name, version, input } = get()
      let initialState: State
      try {
        initialState = JSON.parse(input || '{}')
      } catch {
        return set({ status: 'error', error: 'Input is not valid JSON' })
      }
      try {
        begin(execute(toGraph(nodes, edges, { name, version }), initialState, context()))
      } catch (e) {
        return set({ status: 'error', error: (e as Error).message })
      }
      await pump(false)
    },

    stepOnce: async () => {
      if (!gen) {
        await get().start()
        return
      }
      await pump(true)
    },
    resume: () => pump(false),
    stop: () => {
      gen = null
      set({ status: 'idle' })
    },

    editState: (patch) => set({ pendingEdit: { ...(get().pendingEdit ?? {}), ...patch } }),

    /** Rewind: restart from a recorded snapshot. Steps before this one are never re-run. */
    rewindTo: async (step, edit = {}) => {
      const { nodes, edges, name, version, steps } = get()
      const prior: RunResult = {
        state: {},
        steps,
        snapshots: steps.map((s) => s.stateBefore),
        status: 'done',
      }
      const graph = toGraph(nodes, edges, { name, version })
      try {
        begin(replayFrom(prior, step, context(), graph, edit), steps.slice(0, step))
      } catch (e) {
        return set({ status: 'error', error: (e as Error).message })
      }
      await pump(true)
    },

    inspect: (currentStep) => set({ currentStep }),

    runs: [],
    refreshRuns: async () => set({ runs: await loadRuns() }),
  }
})
