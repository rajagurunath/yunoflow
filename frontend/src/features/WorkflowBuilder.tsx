import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, type Connection, MarkerType, ReactFlow,
  useEdgesState, useNodesState,
} from "@xyflow/react";
import { api, openRunSocket } from "../lib/api";
import type { Agent, GraphJSON, Run, Workflow, WSEvent } from "../lib/types";
import { layoutPositions } from "../lib/layout";
import { nodeTypes } from "../nodes/nodes";
import { Button, Panel, Pill, statusTone } from "../components/ui";

function buildRF(graph: GraphJSON, agentsById: Record<string, Agent>) {
  const g: GraphJSON = { nodes: graph?.nodes ?? [], edges: graph?.edges ?? [] };
  const pos = layoutPositions(g);
  const nodes = g.nodes.map((n) => {
    const agent = n.data?.agent_id ? agentsById[n.data.agent_id] : undefined;
    const label = agent?.name
      ?? (n.type === "condition" ? "Route" : n.type === "start" ? "start" : n.type === "end" ? "end" : n.id);
    const sub = agent ? agent.model : n.type === "condition" ? (n.data?.mode ?? "router") : n.type;
    const branches = n.type === "condition" ? (n.data?.branches || []).map((b: any) => b.label) : undefined;
    // Honor a saved position if present, else fall back to auto-layout.
    const position = n.position && typeof n.position.x === "number" ? n.position : (pos[n.id] || { x: 0, y: 0 });
    // Preserve the source node data (agent_id, condition config) so we can serialize back on Save.
    return { id: n.id, type: n.type, position,
             data: { label, sub, status: "idle", branches, src: n.data ?? {} } };
  });
  const edges = g.edges.map((e) => ({
    id: e.id, source: e.source, target: e.target,
    label: e.data?.when ?? e.label ?? undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#2bf5b8" },
  }));
  return { nodes, edges };
}

export function WorkflowBuilder({ workflowId, onOpen }: { workflowId: string | null; onOpen: (id: string) => void }) {
  const [wf, setWf] = useState<Workflow | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [hud, setHud] = useState({ tokens: 0, cost: 0, status: "" });
  const [message, setMessage] = useState("I was charged twice for order #A123 — please refund the duplicate.");
  const [editStatus, setEditStatus] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed, color: "#2bf5b8" } }, eds));
  }, [setEdges]);

  const serializeGraph = useCallback(() => ({
    nodes: nodes.map((n) => ({
      id: n.id, type: n.type, data: n.data?.src ?? {},
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    })),
    edges: edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      data: e.data ?? {}, label: e.label ?? null,
    })),
  }), [nodes, edges]);

  const save = async () => {
    if (!wf) return;
    setEditStatus("saving…");
    try {
      await api.patchWorkflow(wf.id, serializeGraph());
      setEditStatus("saved ✓");
    } catch (err) {
      setEditStatus(`save failed: ${err}`);
    }
  };

  const validate = async () => {
    if (!wf) return;
    setEditStatus("validating…");
    await api.patchWorkflow(wf.id, serializeGraph());           // validate what's on screen
    const r = await api.validateWorkflow(wf.id);
    setEditStatus(r.ok ? "valid ✓" : `${r.errors.length} error(s): ${r.errors.map((e: any) => e.message).join("; ")}`);
  };

  useEffect(() => { api.listWorkflows().then(setWorkflows).catch(() => {}); }, [run]);

  useEffect(() => {
    if (!workflowId) return;
    (async () => {
      const w = await api.getWorkflow(workflowId);
      const ids = (w.graph_json?.nodes ?? []).filter((n) => n.data?.agent_id).map((n) => n.data.agent_id);
      const agents = await api.listAgents().catch(() => []);
      const byId: Record<string, Agent> = {};
      agents.forEach((a) => { if (ids.includes(a.id)) byId[a.id] = a; });
      const rf = buildRF(w.graph_json, byId);
      setWf(w); setNodes(rf.nodes); setEdges(rf.edges);
      setEvents([]); setRun(null); setHud({ tokens: 0, cost: 0, status: "" });
    })();
    return () => wsRef.current?.close();
  }, [workflowId]);

  const markNode = useCallback((id: string, status: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, status } } : n)));
  }, [setNodes]);

  const start = async () => {
    if (!wf) return;
    setEvents([]); setHud({ tokens: 0, cost: 0, status: "running" });
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: "idle" } })));
    const r = await api.createRun(wf.id, message);
    setRun(r);
    wsRef.current?.close();
    wsRef.current = openRunSocket(r.id, (e) => {
      setEvents((prev) => [...prev, e]);
      if ((e.type === "node_exit" || e.type === "agent_message") && e.data?.node_id) markNode(e.data.node_id, "done");
      if (e.type === "token_usage") setHud({ tokens: e.data.cumulative_tokens, cost: e.data.cumulative_cost_usd, status: "running" });
      if (e.type === "run_completed") setHud((h) => ({ ...h, status: "completed" }));
      if (e.type === "interrupt") setHud((h) => ({ ...h, status: "waiting_human" }));
      if (e.type === "error") setHud((h) => ({ ...h, status: "failed" }));
    });
  };

  if (!workflowId || !wf) {
    return (
      <div className="h-full overflow-auto p-8">
        <h1 className="font-disp text-2xl font-semibold">Workflows</h1>
        <p className="mt-1 text-t2">Open a workflow to edit and run it, or create one from a template.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((w) => (
            <Panel key={w.id} className="cursor-pointer p-4 hover:border-line2" >
              <div className="font-disp text-base">{w.name}</div>
              <div className="mt-1 font-mono text-[11px] text-t2">{(w.graph_json?.nodes?.length ?? 0)} nodes · {(w.graph_json?.edges?.length ?? 0)} edges</div>
              <div className="mt-3"><Button onClick={() => onOpen(w.id)}>Open →</Button></div>
            </Panel>
          ))}
          {workflows.length === 0 && <div className="text-t2">No workflows yet — start from a template.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[1fr_380px] overflow-hidden">
      <div className="relative">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-3">
          <span className="font-disp text-sm">{wf.name}</span>
          <input value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-96 rounded-lg border border-line2 bg-bg1/90 px-3 py-1.5 text-sm outline-none focus:border-mint/50" />
          <Button variant="primary" onClick={start} disabled={hud.status === "running"}>▶ Run</Button>
          <Button onClick={save}>Save</Button>
          <Button onClick={validate}>Validate</Button>
          {hud.status && <Pill tone={statusTone(hud.status)}>● {hud.status}</Pill>}
          {editStatus && <span className="font-mono text-[11px] text-t2">{editStatus}</span>}
        </div>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ style: { stroke: "rgba(255,255,255,.2)", strokeWidth: 2 } }}>
          <Background variant={BackgroundVariant.Dots} gap={26} size={1.1} color="rgba(255,255,255,.12)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <Panel className="m-3 flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-t2">⠿ Live Monitor</div>
        <div className="grid grid-cols-2 gap-3 px-4 py-3">
          <div><div className="font-mono text-[11px] text-t2">tokens</div><div className="font-mono text-lg text-mint">{hud.tokens.toLocaleString()}</div></div>
          <div><div className="font-mono text-[11px] text-t2">cost</div><div className="font-mono text-lg text-mint">${hud.cost.toFixed(4)}</div></div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <div className="relative border-l border-line2 pl-4">
            {events.filter((e) => e.type !== "node_exit").map((e, i) => (
              <div key={i} className="relative py-2">
                <span className="absolute -left-[21px] top-3 h-2 w-2 rounded-full bg-mint" />
                <div className="font-mono text-[10px] text-t2">{e.type} · {e.data?.node_id || ""}</div>
                {e.data?.content && <div className="mt-0.5 text-[12.5px] text-t1">{String(e.data.content).slice(0, 220)}</div>}
                {e.type === "token_usage" && <div className="font-mono text-[10px] text-t3">{e.data.total_tokens} tok · ${Number(e.data.cost_usd).toFixed(5)}</div>}
                {e.type === "interrupt" && <div className="mt-0.5 text-[12.5px] text-amber">{e.data.value}</div>}
              </div>
            ))}
            {events.length === 0 && <div className="py-2 text-sm text-t2">Press Run to stream live agent activity.</div>}
          </div>
        </div>
      </Panel>
    </div>
  );
}
