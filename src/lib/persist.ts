import { createStore, del, set, values } from "idb-keyval";
import type {
  RunResult,
  State,
  StepEvent,
} from "../../packages/engine/index.ts";
import type { LoomDoc } from "./graph.ts";

const DOC_KEY = "agentloom.doc";
const KEY_KEY = "agentloom.apiKey";

// Graphs are small, so localStorage is fine. Traces are not, and Analyze mode needs many
// of them. Those go to IndexedDB.
const runStore = createStore("agentloom", "runs");

export const loadDoc = (): LoomDoc | null => {
  const raw = localStorage.getItem(DOC_KEY);
  return raw ? (JSON.parse(raw) as LoomDoc) : null;
};
export const saveDoc = (doc: LoomDoc) =>
  localStorage.setItem(DOC_KEY, JSON.stringify(doc));

export const loadApiKey = () => localStorage.getItem(KEY_KEY) ?? "";
export const saveApiKey = (key: string) =>
  key ? localStorage.setItem(KEY_KEY, key) : localStorage.removeItem(KEY_KEY);

const VERSIONS_KEY = "agentloom.versions";

/** Frozen copies of the graph, so Analyze mode has two things to compare. */
export const loadVersions = (): LoomDoc[] =>
  JSON.parse(localStorage.getItem(VERSIONS_KEY) ?? "[]");
export const saveVersion = (doc: LoomDoc): LoomDoc[] => {
  const all = loadVersions();
  const next = [...all, { ...doc, version: all.length + 1 }];
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
  return next;
};

export type RunRecord = {
  id: string;
  graphName: string;
  graphVersion: number;
  startedAt: number;
  status: RunResult["status"] | "running";
  steps: StepEvent[];
  finalState: State;
};

export const saveRun = (record: RunRecord) => set(record.id, record, runStore);
export const deleteRun = (id: string) => del(id, runStore);
export const loadRuns = async (): Promise<RunRecord[]> => {
  const all = (await values(runStore)) as RunRecord[];
  return all.sort((a, b) => b.startedAt - a.startedAt);
};

export const download = (filename: string, data: unknown) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
