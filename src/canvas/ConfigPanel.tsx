import { MODELS } from '../../packages/engine/index.ts'
import { readsOf, writesOf, type LoomNode } from '../lib/graph.ts'
import { useStore } from '../store.ts'
import { control, Field, SectionTitle } from '../ui.tsx'
import { TypeDot } from './LoomNodeView.tsx'

const mono = `${control} font-mono text-meta`

export function ConfigPanel() {
  const selectedId = useStore((s) => s.selectedId)
  const node = useStore((s) => s.nodes.find((n) => n.id === s.selectedId))
  const updateNode = useStore((s) => s.updateNode)
  const deleteNode = useStore((s) => s.deleteNode)

  if (!node || !selectedId) {
    return (
      <div className="p-5">
        <p className="text-ui text-text-dim">
          Pick a node on the canvas to edit it, or add one from the left.
        </p>
      </div>
    )
  }

  const data = node.data as LoomNode['data']
  const cfg = data.config as Record<string, never>
  const setCfg = (patch: Record<string, unknown>) =>
    updateNode(selectedId, { config: { ...data.config, ...patch } })

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-2.5">
        <TypeDot type={data.type} size={8} />
        <SectionTitle>{data.type}</SectionTitle>
        <span className="ml-auto font-mono text-micro text-text-faint">{selectedId}</span>
      </div>

      <Field label="Name">
        <input
          className={control}
          value={data.label}
          onChange={(e) => updateNode(selectedId, { label: e.target.value })}
        />
      </Field>

      {data.type === 'input' && (
        <Field label="Starting state" hint="JSON">
          <textarea
            className={`${mono} h-32`}
            defaultValue={JSON.stringify(cfg.seed ?? {}, null, 2)}
            onBlur={(e) => {
              try {
                setCfg({ seed: JSON.parse(e.target.value || '{}') })
              } catch {
                /* keep the last good value until it parses */
              }
            }}
          />
        </Field>
      )}

      {data.type === 'llm' && (
        <>
          <Field label="Model">
            <select className={control} value={cfg.model ?? MODELS[0]} onChange={(e) => setCfg({ model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="System prompt" hint="optional">
            <textarea className={`${mono} h-20`} value={cfg.system ?? ''} onChange={(e) => setCfg({ system: e.target.value })} />
          </Field>
          <Field label="Prompt" hint="{{ state.key }} fills from state">
            <textarea className={`${mono} h-44`} value={cfg.prompt ?? ''} onChange={(e) => setCfg({ prompt: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Writes to">
              <input className={mono} value={cfg.outputKey ?? ''} onChange={(e) => setCfg({ outputKey: e.target.value })} />
            </Field>
            <Field label="Max tokens">
              <input
                className={`${control} tnum`}
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
          <Field label="Kind">
            <select className={control} value={cfg.kind ?? 'http'} onChange={(e) => setCfg({ kind: e.target.value })}>
              <option value="http">HTTP request</option>
              <option value="js">JavaScript, sandboxed in a worker</option>
            </select>
          </Field>
          {cfg.kind === 'js' ? (
            <Field label="Code" hint="receives state, returns a value">
              <textarea className={`${mono} h-44`} value={cfg.code ?? ''} onChange={(e) => setCfg({ code: e.target.value })} />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-[96px_1fr] gap-3">
                <Field label="Method">
                  <select className={control} value={cfg.method ?? 'GET'} onChange={(e) => setCfg({ method: e.target.value })}>
                    {['GET', 'POST', 'PUT', 'DELETE'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="URL">
                  <input className={mono} value={cfg.url ?? ''} onChange={(e) => setCfg({ url: e.target.value })} />
                </Field>
              </div>
              <Field label="Body">
                <textarea className={`${mono} h-28`} value={cfg.body ?? ''} onChange={(e) => setCfg({ body: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Writes to">
            <input className={mono} value={cfg.outputKey ?? ''} onChange={(e) => setCfg({ outputKey: e.target.value })} />
          </Field>
        </>
      )}

      {data.type === 'condition' && (
        <Field label="Branches" hint="first match wins, otherwise else">
          <div className="space-y-2">
            {((cfg.branches ?? []) as { handle: string; expr: string }[]).map((b, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Branch ${i + 1} name`}
                  className={`${mono} w-28`}
                  value={b.handle}
                  onChange={(e) => {
                    const branches = [...(cfg.branches as { handle: string; expr: string }[])]
                    branches[i] = { ...b, handle: e.target.value }
                    setCfg({ branches })
                  }}
                />
                <input
                  aria-label={`Branch ${i + 1} condition`}
                  className={mono}
                  value={b.expr}
                  onChange={(e) => {
                    const branches = [...(cfg.branches as { handle: string; expr: string }[])]
                    branches[i] = { ...b, expr: e.target.value }
                    setCfg({ branches })
                  }}
                />
                <button
                  aria-label={`Remove branch ${b.handle}`}
                  className="px-1 text-text-faint transition-colors hover:text-halt"
                  onClick={() => setCfg({ branches: (cfg.branches as unknown[]).filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="text-meta text-pick transition-opacity hover:opacity-80"
              onClick={() =>
                setCfg({ branches: [...((cfg.branches ?? []) as unknown[]), { handle: 'new', expr: 'true' }] })
              }
            >
              Add a branch
            </button>
          </div>
        </Field>
      )}

      {data.type === 'loop' && (
        <>
          <Field label="For each" hint="state key holding an array">
            <input className={mono} value={cfg.over ?? ''} onChange={(e) => setCfg({ over: e.target.value })} />
          </Field>
          <Field label="Or repeat while" hint="expression">
            <input className={mono} value={cfg.while ?? ''} onChange={(e) => setCfg({ while: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Each item lands in">
              <input className={mono} value={cfg.itemKey ?? ''} onChange={(e) => setCfg({ itemKey: e.target.value })} />
            </Field>
            <Field label="Stop after">
              <input
                className={`${control} tnum`}
                type="number"
                value={cfg.maxIterations ?? 100}
                onChange={(e) => setCfg({ maxIterations: Number(e.target.value) })}
              />
            </Field>
          </div>
        </>
      )}

      {data.type === 'approval' && (
        <Field label="Message at the gate">
          <input className={control} value={cfg.message ?? ''} onChange={(e) => setCfg({ message: e.target.value })} />
        </Field>
      )}

      <div className="space-y-2.5 rounded-lg border border-line bg-ink-900 p-3">
        <div className="flex gap-3">
          <span className="w-12 shrink-0 text-meta text-text-faint">Reads</span>
          <span className="font-mono text-meta text-sky-300">{readsOf(data).join('  ') || 'nothing'}</span>
        </div>
        <div className="flex gap-3">
          <span className="w-12 shrink-0 text-meta text-text-faint">Writes</span>
          <span className="font-mono text-meta text-live">{writesOf(data).join('  ') || 'nothing'}</span>
        </div>
      </div>

      <button
        onClick={() => deleteNode(selectedId)}
        className="text-meta text-text-faint transition-colors hover:text-halt"
      >
        Delete this node
      </button>
    </div>
  )
}
