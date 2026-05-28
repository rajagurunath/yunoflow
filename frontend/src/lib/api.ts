import type {
  Agent, ChannelBinding, Message, MetricsSummary, Run, Template, ToolSpec, Workflow, WSEvent,
} from "./types";

// Where the backend lives. Empty = same-origin (the box serves the SPA + proxies
// /api via nginx). On Vercel, set VITE_API_URL to the backend's HTTPS origin
// (e.g. https://138-199-238-92.sslip.io) so REST + WebSocket reach the box.
export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// Swagger / OpenAPI UI (served by the backend, proxied at the same origin).
export const API_DOCS_URL = `${API_BASE}/docs`;

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const b = await r.json(); if (b?.detail) msg = b.detail; } catch { /* keep status */ }
    throw new Error(msg);
  }
  return (r.status === 204 ? null : await r.json()) as T;
}
const f = (path: string, init?: RequestInit) => fetch(API_BASE + path, init);
const post = (path: string, body?: unknown) =>
  f(path, { method: "POST", headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  listAgents: () => f("/api/agents").then(j<Agent[]>),
  createAgent: (a: Partial<Agent>) => post("/api/agents", a).then(j<Agent>),
  updateAgent: (id: string, a: Partial<Agent>) =>
    f(`/api/agents/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(a),
    }).then(j<Agent>),
  deleteAgent: (id: string) => f(`/api/agents/${id}`, { method: "DELETE" }).then(() => null),
  tools: () => f("/api/tools").then(j<ToolSpec[]>),

  listTemplates: () => f("/api/templates").then(j<Template[]>),
  instantiate: (id: string, name?: string) => post(`/api/templates/${id}/instantiate`, { name }).then(j<Workflow>),

  listWorkflows: () => f("/api/workflows").then(j<Workflow[]>),
  getWorkflow: (id: string) => f(`/api/workflows/${id}`).then(j<Workflow>),
  createWorkflow: (w: { name: string; description?: string; graph_json: unknown }) =>
    post("/api/workflows", w).then(j<Workflow>),
  generateWorkflow: (prompt: string) => post("/api/workflows/generate", { prompt }).then(j<Workflow>),
  patchWorkflow: (id: string, graph_json: unknown) =>
    f(`/api/workflows/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph_json }),
    }).then(j<Workflow>),
  validateWorkflow: (id: string) => post(`/api/workflows/${id}/validate`).then(j<any>),
  updateWorkflow: (id: string, body: Partial<Workflow>) =>
    f(`/api/workflows/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<Workflow>),
  metrics: () => f("/api/metrics/summary").then(j<MetricsSummary>),

  createRun: (workflow_id: string, message: string) =>
    post("/api/runs", { workflow_id, input: { message } }).then(j<Run>),
  resumeRun: (id: string, value: string) => post(`/api/runs/${id}/resume`, { value }).then(j<Run>),
  getRun: (id: string) => f(`/api/runs/${id}`).then(j<Run>),
  runMessages: (id: string) => f(`/api/runs/${id}/messages`).then(j<Message[]>),
  runEvents: (id: string) => f(`/api/runs/${id}/events`).then(j<WSEvent[]>),
  listRuns: () => f("/api/runs").then(j<Run[]>),

  listChannels: () => f("/api/channels").then(j<ChannelBinding[]>),
  channelStatus: () => f("/api/channels/status").then(j<Record<string, any>>),
  createChannel: (b: { channel_type: string; workflow_id: string; bot_token?: string; label?: string; notify_chat_id?: string }) =>
    post("/api/channels", b).then(j<ChannelBinding>),
  deleteChannel: (id: string) => f(`/api/channels/${id}`, { method: "DELETE" }).then(() => null),
};

export function openRunSocket(runId: string, onEvent: (e: WSEvent) => void): WebSocket {
  // ws(s) origin: the configured API base if set, else the page origin.
  const base = API_BASE || location.origin;
  const wsBase = base.replace(/^http/, "ws"); // http->ws, https->wss
  const ws = new WebSocket(`${wsBase}/api/ws/runs/${runId}`);
  ws.onmessage = (m) => {
    try { onEvent(JSON.parse(m.data)); } catch { /* ignore */ }
  };
  return ws;
}
