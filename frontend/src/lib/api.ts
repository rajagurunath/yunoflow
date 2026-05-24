import type {
  Agent, ChannelBinding, Message, Run, Template, ToolSpec, Workflow, WSEvent,
} from "./types";

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (r.status === 204 ? null : await r.json()) as T;
}
const post = (url: string, body?: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  listAgents: () => fetch("/api/agents").then(j<Agent[]>),
  createAgent: (a: Partial<Agent>) => post("/api/agents", a).then(j<Agent>),
  deleteAgent: (id: string) => fetch(`/api/agents/${id}`, { method: "DELETE" }).then(() => null),
  tools: () => fetch("/api/tools").then(j<ToolSpec[]>),

  listTemplates: () => fetch("/api/templates").then(j<Template[]>),
  instantiate: (id: string, name?: string) => post(`/api/templates/${id}/instantiate`, { name }).then(j<Workflow>),

  listWorkflows: () => fetch("/api/workflows").then(j<Workflow[]>),
  getWorkflow: (id: string) => fetch(`/api/workflows/${id}`).then(j<Workflow>),
  createWorkflow: (w: { name: string; description?: string; graph_json: unknown }) =>
    post("/api/workflows", w).then(j<Workflow>),
  patchWorkflow: (id: string, graph_json: unknown) =>
    fetch(`/api/workflows/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph_json }),
    }).then(j<Workflow>),
  validateWorkflow: (id: string) => post(`/api/workflows/${id}/validate`).then(j<any>),

  createRun: (workflow_id: string, message: string) =>
    post("/api/runs", { workflow_id, input: { message } }).then(j<Run>),
  getRun: (id: string) => fetch(`/api/runs/${id}`).then(j<Run>),
  runMessages: (id: string) => fetch(`/api/runs/${id}/messages`).then(j<Message[]>),
  runEvents: (id: string) => fetch(`/api/runs/${id}/events`).then(j<WSEvent[]>),
  listRuns: () => fetch("/api/runs").then(j<Run[]>),

  listChannels: () => fetch("/api/channels").then(j<ChannelBinding[]>),
  channelStatus: () => fetch("/api/channels/status").then(j<Record<string, any>>),
  createChannel: (b: { channel_type: string; workflow_id: string }) =>
    post("/api/channels", b).then(j<ChannelBinding>),
  deleteChannel: (id: string) => fetch(`/api/channels/${id}`, { method: "DELETE" }).then(() => null),
};

export function openRunSocket(runId: string, onEvent: (e: WSEvent) => void): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/api/ws/runs/${runId}`);
  ws.onmessage = (m) => {
    try { onEvent(JSON.parse(m.data)); } catch { /* ignore */ }
  };
  return ws;
}
