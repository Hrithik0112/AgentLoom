import { useEffect, useRef } from 'react'
import { NODE_TYPES, type LoomDoc } from './lib/graph.ts'
import { download } from './lib/persist.ts'
import { AnalyzePanel } from './analyze/AnalyzePanel.tsx'
import { Canvas } from './canvas/Canvas.tsx'
import { ConfigPanel } from './canvas/ConfigPanel.tsx'
import { TYPE_COLOR } from './canvas/LoomNodeView.tsx'
import { DebugPanel } from './debug/DebugPanel.tsx'
import { EXAMPLES } from './examples.ts'
import { useStore, type Mode } from './store.ts'

const MODES: Mode[] = ['build', 'debug', 'analyze']

export default function App() {
  const {
    mode,
    setMode,
    name,
    rename,
    nodes,
    edges,
    addNode,
    apiKey,
    setApiKey,
    loadDocument,
    setInput,
    refreshRuns,
  } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refreshRuns()
  }, [refreshRuns])

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <span className="font-semibold tracking-tight">
          agent<span className="text-emerald-400">loom</span>
        </span>

        <input
          className="w-48 rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-zinc-700 focus:border-sky-500 focus:outline-none"
          value={name}
          onChange={(e) => rename(e.target.value)}
        />

        <nav className="flex rounded border border-zinc-800">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs capitalize ${mode === m ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {m}
            </button>
          ))}
        </nav>

        <select
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
          defaultValue=""
          onChange={(e) => {
            const example = EXAMPLES.find((x) => x.name === e.target.value)
            if (!example) return
            loadDocument(example.doc)
            setInput(example.input)
          }}
        >
          <option value="" disabled>
            load example
          </option>
          {EXAMPLES.map((x) => (
            <option key={x.name}>{x.name}</option>
          ))}
        </select>

        <button
          className="text-xs text-zinc-500 hover:text-zinc-200"
          onClick={() => download(`${name.replace(/\s+/g, '-').toLowerCase()}.json`, { name, version: 1, nodes, edges })}
        >
          export
        </button>
        <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={() => fileInput.current?.click()}>
          import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) loadDocument(JSON.parse(await file.text()) as LoomDoc)
            e.target.value = ''
          }}
        />

        <div className="ml-auto flex items-center gap-2">
          <input
            type="password"
            placeholder="anthropic api key"
            className="w-56 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs outline-none focus:border-sky-500"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <span
            className="cursor-help text-[10px] text-zinc-600"
            title="Stored in this browser only. It is sent to api.anthropic.com and nowhere else."
          >
            stays local
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        {mode === 'build' && (
          <aside className="w-40 shrink-0 space-y-1 border-r border-zinc-800 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">add node</div>
            {NODE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => addNode(t)}
                className="flex w-full items-center gap-2 rounded border border-zinc-800 px-2 py-1 text-left text-xs hover:border-zinc-600"
              >
                <span className={`h-2 w-2 rounded-full ${TYPE_COLOR[t]}`} />
                {t}
              </button>
            ))}
          </aside>
        )}

        {mode === 'analyze' ? (
          <AnalyzePanel />
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <Canvas />
            </div>
            <aside className="w-96 shrink-0 overflow-y-auto border-l border-zinc-800">
              {mode === 'build' ? <ConfigPanel /> : <DebugPanel />}
            </aside>
          </>
        )}
      </main>
    </div>
  )
}
