import { MODELS } from '../../packages/engine/index.ts'
import { readsOf, writesOf, type LoomNode } from '../lib/graph.ts'
import { useStore } from '../store.ts'
import { TYPE_COLOR } from './LoomNodeView.tsx'

const input = 'w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm outline-none focus:border-sky-500'
const label = 'block text-[11px] uppercase tracking-wide text-zinc-500 mb-1'

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={label}>{title}</span>
      {children}
    </div>
  )
}

export function ConfigPanel() {
  const selectedId = useStore((s) => s.selectedId)
  const node = useStore((s) => s.nodes.find((n) => n.id === s.selectedId))
  const updateNode = useStore((s) => s.updateNode)
  const deleteNode = useStore((s) => s.deleteNode)

  if (!node || !selectedId) {
    return <p className="p-4 text-sm text-zinc-500">Select a node to configure it.</p>
  }

  const data = node.data as LoomNode['data']
  const cfg = data.config as Record<string, never>
  const setCfg = (patch: Record<string, unknown>) =>
    updateNode(selectedId, { config: { ...data.config, ...patch } })

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${TYPE_COLOR[data.type]}`} />
        <span className="font-mono text-xs text-zinc-400">{data.type}</span>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">{selectedId}</span>
      </div>

      <Field title="label">
        <input className={input} value={data.label} onChange={(e) => updateNode(selectedId, { label: e.target.value })} />
      </Field>

      {data.type === 'input' && (
        <Field title="seed state (JSON)">
          <textarea
            className={`${input} h-28 font-mono text-xs`}
            defaultValue={JSON.stringify(cfg.seed ?? {}, null, 2)}
            onBlur={(e) => {
              try {
                setCfg({ seed: JSON.parse(e.target.value || '{}') })
              } catch {
                /* leave the previous value in place until it parses */
              }
            }}
          />
        </Field>
      )}

      {data.type === 'llm' && (
        <>
          <Field title="model">
            <select className={input} value={cfg.model ?? MODELS[0]} onChange={(e) => setCfg({ model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field title="system (optional)">
            <textarea className={`${input} h-16 font-mono text-xs`} value={cfg.system ?? ''} onChange={(e) => setCfg({ system: e.target.value })} />
          </Field>
          <Field title="prompt">
            <textarea className={`${input} h-40 font-mono text-xs`} value={cfg.prompt ?? ''} onChange={(e) => setCfg({ prompt: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field title="writes to">
              <input className={input} value={cfg.outputKey ?? ''} onChange={(e) => setCfg({ outputKey: e.target.value })} />
            </Field>
            <Field title="max tokens">
              <input
                className={input}
                type="number"
                value={cfg.maxTokens ?? 4096}
                onChange={(e) => setCfg({ maxTokens: Number(e.target.value) })}
              />
            </Field>
          </div>
        </>
      )}

      {data.type === 'tool' && (
        <>
          <Field title="kind">
            <select className={input} value={cfg.kind ?? 'http'} onChange={(e) => setCfg({ kind: e.target.value })}>
              <option value="http">http request</option>
              <option value="js">javascript (runs in a worker)</option>
            </select>
          </Field>
          {cfg.kind === 'js' ? (
            <Field title="code (receives `state`, returns a value)">
              <textarea className={`${input} h-40 font-mono text-xs`} value={cfg.code ?? ''} onChange={(e) => setCfg({ code: e.target.value })} />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <Field title="method">
                  <select className={input} value={cfg.method ?? 'GET'} onChange={(e) => setCfg({ method: e.target.value })}>
                    {['GET', 'POST', 'PUT', 'DELETE'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field title="url">
                  <input className={`${input} font-mono text-xs`} value={cfg.url ?? ''} onChange={(e) => setCfg({ url: e.target.value })} />
                </Field>
              </div>
              <Field title="body">
                <textarea className={`${input} h-24 font-mono text-xs`} value={cfg.body ?? ''} onChange={(e) => setCfg({ body: e.target.value })} />
              </Field>
            </>
          )}
          <Field title="writes to">
            <input className={input} value={cfg.outputKey ?? ''} onChange={(e) => setCfg({ outputKey: e.target.value })} />
          </Field>
        </>
      )}

      {data.type === 'condition' && (
        <Field title="branches (first truthy wins, otherwise `else`)">
          <div className="space-y-2">
            {((cfg.branches ?? []) as { handle: string; expr: string }[]).map((b, i) => (
              <div key={i} className="flex gap-1">
                <input
                  className={`${input} w-24`}
                  value={b.handle}
                  onChange={(e) => {
                    const branches = [...(cfg.branches as { handle: string; expr: string }[])]
                    branches[i] = { ...b, handle: e.target.value }
                    setCfg({ branches })
                  }}
                />
                <input
                  className={`${input} font-mono text-xs`}
                  value={b.expr}
                  onChange={(e) => {
                    const branches = [...(cfg.branches as { handle: string; expr: string }[])]
                    branches[i] = { ...b, expr: e.target.value }
                    setCfg({ branches })
                  }}
                />
                <button
                  className="px-1 text-zinc-500 hover:text-red-400"
                  onClick={() => setCfg({ branches: (cfg.branches as unknown[]).filter((_, j) => j !== i) })}
                >
                  x
                </button>
              </div>
            ))}
            <button
              className="text-xs text-sky-400 hover:underline"
              onClick={() => setCfg({ branches: [...((cfg.branches ?? []) as unknown[]), { handle: 'new', expr: 'true' }] })}
            >
              + branch
            </button>
          </div>
        </Field>
      )}

      {data.type === 'loop' && (
        <>
          <Field title="over (state key holding an array)">
            <input className={`${input} font-mono text-xs`} value={cfg.over ?? ''} onChange={(e) => setCfg({ over: e.target.value })} />
          </Field>
          <Field title="or while (expression)">
            <input className={`${input} font-mono text-xs`} value={cfg.while ?? ''} onChange={(e) => setCfg({ while: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field title="item key">
              <input className={input} value={cfg.itemKey ?? ''} onChange={(e) => setCfg({ itemKey: e.target.value })} />
            </Field>
            <Field title="max iterations">
              <input
                className={input}
                type="number"
                value={cfg.maxIterations ?? 100}
                onChange={(e) => setCfg({ maxIterations: Number(e.target.value) })}
              />
            </Field>
          </div>
        </>
      )}

      {data.type === 'approval' && (
        <Field title="message shown at the gate">
          <input className={input} value={cfg.message ?? ''} onChange={(e) => setCfg({ message: e.target.value })} />
        </Field>
      )}

      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2 font-mono text-[11px]">
        <div className="text-zinc-500">reads</div>
        <div className="mb-2 text-sky-300">{readsOf(data).join(', ') || 'nothing'}</div>
        <div className="text-zinc-500">writes</div>
        <div className="text-emerald-300">{writesOf(data).join(', ') || 'nothing'}</div>
      </div>

      <button onClick={() => deleteNode(selectedId)} className="text-xs text-zinc-500 hover:text-red-400">
        delete node
      </button>
    </div>
  )
}
