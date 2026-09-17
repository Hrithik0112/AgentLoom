import type { State, ToolRunner } from "../../packages/engine/index.ts";

/**
 * Runs a `tool` node's JS in a Worker. This is a trust boundary, not polish: on the main
 * thread a shared workflow's snippet could hang the editor or read this tab's storage.
 */
const WORKER_SRC = `
self.onmessage = async (e) => {
  const { id, code, state } = e.data
  try {
    const fn = new Function('state', code)
    self.postMessage({ id, value: await fn(state) })
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) })
  }
}
`;

const TIMEOUT_MS = 10_000;

export class WorkerToolRunner implements ToolRunner {
  private url = URL.createObjectURL(
    new Blob([WORKER_SRC], { type: "text/javascript" }),
  );
  private seq = 0;

  run(code: string, state: State): Promise<unknown> {
    const worker = new Worker(this.url);
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      // A snippet with an infinite loop can't be interrupted from outside, so the only
      // real escape is to terminate the worker.
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error(`Tool timed out after ${TIMEOUT_MS / 1000}s`));
      }, TIMEOUT_MS);

      worker.onmessage = (e) => {
        if (e.data.id !== id) return;
        clearTimeout(timer);
        worker.terminate();
        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.value);
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(e.message));
      };
      worker.postMessage({ id, code, state: structuredClone(state) });
    });
  }
}
