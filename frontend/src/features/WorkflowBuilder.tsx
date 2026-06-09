import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, type Connection, MarkerType, ReactFlow,
  useEdgesState, useNodesState,
} from "@xyflow/react";
import { api, openRunSocket } from "../lib/api";
import type { Agent, GraphJSON, Run, Workflow, WSEvent } from "../lib/types";
import { layoutPositions } from "../lib/layout";
import { recordingSupported, startRecording, startVoice, voiceSupported } from "../lib/voice";
import { nodeTypes } from "../nodes/nodes";
import { Button, Panel, Pill, statusTone } from "../components/ui";

function buildRF(graph: GraphJSON, agentsById: Record<string, Agent>) {
  const g: GraphJSON = { nodes: graph?.nodes ?? [], edges: graph?.edges ?? [] };
  const pos = layoutPositions(g);
  const nodes = g.nodes.map((n) => {
    const agent = n.data?.agent_id ? agentsById[n.data.agent_id] : undefined;
    const label = agent?.name
      ?? (n.type === "condition" ? "Route" : n.type === "human" ? "Human approval"
          : n.type === "start" ? "start" : n.type === "end" ? "end" : n.id);
    const sub = agent ? agent.model
      : n.type === "condition" ? (n.data?.mode ?? "router")
      : n.type === "human" ? "human-in-the-loop" : n.type;
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
    markerEnd: { type: MarkerType.ArrowClosed, color: "#12876a" },
  }));
  return { nodes, edges };
}

const DOT: Record<string, string> = {
  mint: "bg-mint", cyan: "bg-cyan", amber: "bg-amber", coral: "bg-coral", t2: "bg-t3",
};

// Turn a raw WS event into a human-readable activity-log line.
function describeEvent(e: WSEvent): { icon: string; title: string; detail?: string; tone: string } {
  const node = e.data?.node_id;
  switch (e.type) {
    case "run_started": return { icon: "▶", title: "Run started", tone: "mint" };
    case "node_enter": return { icon: "▷", title: `Step running${node ? ` — ${node}` : ""}`, tone: "cyan" };
    case "node_exit": return { icon: "✓", title: `Step finished${node ? ` — ${node}` : ""}`, tone: "t2" };
    case "agent_message":
      return { icon: "💬", title: `${node || "agent"} replied`, detail: e.data?.content, tone: "mint" };
    case "tool_call": return { icon: "⚒", title: `${node || "agent"} called ${e.data?.name}`, detail: JSON.stringify(e.data?.args ?? {}), tone: "cyan" };
    case "token_usage":
      return {
        icon: "◷", title: `${node || ""} used ${e.data?.total_tokens} tokens`,
        detail: `$${Number(e.data?.cost_usd || 0).toFixed(5)} · running total ${Number(e.data?.cumulative_tokens || 0).toLocaleString()} tok / $${Number(e.data?.cumulative_cost_usd || 0).toFixed(5)}`,
        tone: "cyan",
      };
    case "interrupt": return { icon: "⏸", title: "Waiting for human input", detail: e.data?.value, tone: "amber" };
    case "run_completed":
      return { icon: "✓", title: "Run completed", detail: `${Number(e.data?.total_tokens || 0).toLocaleString()} tokens · $${Number(e.data?.total_cost_usd || 0).toFixed(5)}`, tone: "mint" };
    case "error": return { icon: "✕", title: "Error", detail: e.data?.message, tone: "coral" };
    default: return { icon: "·", title: e.type, tone: "t2" };
  }
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
  const [reply, setReply] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [cron, setCron] = useState("");
  const [schedMsg, setSchedMsg] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [monitor, setMonitor] = useState<"normal" | "wide" | "closed">("normal");
  const wsRef = useRef<WebSocket | null>(null);

  // Natural-language / voice workflow generation (Workflows landing view)
  const [genPrompt, setGenPrompt] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const voiceRef = useRef<{ stop: () => void } | null>(null);
  const recRef = useRef<{ stop: () => Promise<Blob> } | null>(null);
  const recStartRef = useRef<number>(0);

  // Explain-this-workflow + voice-back (TTS).
  const [explain, setExplain] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generate = async () => {
    if (!genPrompt.trim()) return;
    setGenBusy(true); setGenErr(null);
    try {
      const wf = await api.generateWorkflow(genPrompt.trim());
      onOpen(wf.id);
    } catch (e) {
      setGenErr(String(e));
    } finally {
      setGenBusy(false);
    }
  };

  const toggleVoice = async () => {
    // Second tap: stop the recording and upload it for ElevenLabs Scribe STT.
    if (listening && recRef.current) {
      const rec = recRef.current; recRef.current = null;
      setListening(false); setTranscribing(true); setGenErr(null);
      try {
        const blob = await rec.stop();
        const ms = recStartRef.current ? Date.now() - recStartRef.current : 0;
        const kb = Math.round(blob.size / 1024);
        if (ms < 700) {
          setGenErr(`Recording too short (${ms}ms). Tap 🎙, speak a full sentence, then tap ■.`);
        } else {
          const { text } = await api.transcribeAudio(blob);
          if (text && text.trim()) setGenPrompt((p) => (p ? p + " " : "") + text.trim());
          else setGenErr(`Didn't catch any speech (recorded ${kb} KB, ${ms}ms). Speak clearly into your mic, then tap ■. If KB is ~0, your input device may be muted or wrong.`);
        }
      } catch (e) { setGenErr("Transcription failed: " + String(e)); }
      finally { setTranscribing(false); }
      return;
    }
    // Stop an in-progress browser-speech (fallback) session.
    if (listening) { voiceRef.current?.stop(); setListening(false); return; }

    // First tap: start recording. Surface mic errors instead of failing silently.
    setGenErr(null);
    if (recordingSupported()) {
      try {
        recRef.current = await startRecording();
        recStartRef.current = Date.now();
        setListening(true);
        return;
      } catch (e: any) {
        const name = e?.name || "";
        if (name === "NotAllowedError" || name === "SecurityError")
          setGenErr("🎙 Microphone blocked. Click the camera/mic icon in your browser's address bar, allow access, then tap the mic again — or just type your workflow below.");
        else if (name === "NotFoundError")
          setGenErr("🎙 No microphone found. You can type your workflow instead.");
        else if (name !== "NotSupportedError")
          setGenErr("🎙 Couldn't start the mic: " + (e?.message || name || "unknown") + ". You can type instead.");
        // Only fall back to browser Web Speech when recording is genuinely unsupported.
        if (name !== "NotSupportedError") return;
      }
    }
    const handle = startVoice({
      onText: (t) => setGenPrompt(t),
      onEnd: () => setListening(false),
      onError: (err) => { setListening(false); setGenErr("Voice input failed (" + err + "). You can type your workflow instead."); },
    });
    if (handle) { voiceRef.current = handle; setListening(true); }
    else setGenErr("Voice input isn't available in this browser. You can type your workflow below.");
  };

  const explainWf = async () => {
    if (!wf) return;
    setExplainBusy(true); setExplain(null);
    try {
      const r = await api.explainWorkflow(wf.id);
      setExplain(r.explanation || "(no explanation returned)");
    } catch (e) { setExplain("Couldn't explain this workflow: " + String(e)); }
    finally { setExplainBusy(false); }
  };

  const speakText = async (text: string) => {
    if (!text.trim()) return;
    try {
      setSpeaking(true);
      const blob = await api.speak(text);
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch { setSpeaking(false); }
  };

  // When connecting out of a condition node, ask for the branch label.
  const onConnect = useCallback((c: Connection) => {
    const src = nodes.find((n) => n.id === c.source);
    const label = src?.type === "condition"
      ? (window.prompt("Branch label for this edge (e.g. refund):") || undefined) : undefined;
    setEdges((eds) => addEdge(
      { ...c, label, data: label ? { when: label } : {}, markerEnd: { type: MarkerType.ArrowClosed, color: "#12876a" } },
      eds,
    ));
  }, [nodes, setEdges]);

  const addNode = useCallback((type: string, agentId?: string) => {
    const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
    const agent = agentId ? agents.find((a) => a.id === agentId) : undefined;
    const src: any =
      type === "agent" || type === "deepagent" ? { agent_id: agentId }
      : type === "condition" ? { mode: "llm", prompt: "Classify the request.", branches: [], default: null }
      : type === "human" ? { prompt: "Human approval needed — review and reply to continue." }
      : {};
    setNodes((ns) => [...ns, {
      id, type,
      position: { x: 140 + (ns.length % 4) * 70, y: 120 + (ns.length % 5) * 60 },
      data: {
        label: agent?.name ?? (type === "condition" ? "Route" : type === "human" ? "Human approval" : type),
        sub: agent?.model ?? (type === "human" ? "human-in-the-loop" : type), status: "idle",
        branches: type === "condition" ? [] : undefined, src,
      },
    }]);
  }, [agents, setNodes]);

  const serializeGraph = useCallback(() => {
    // Derive condition branches from the labels on its outgoing edges.
    const outLabels: Record<string, string[]> = {};
    edges.forEach((e) => {
      const l = e.data?.when ?? e.label;
      if (l) (outLabels[e.source] ||= []).push(String(l));
    });
    return {
      nodes: nodes.map((n) => {
        let data = n.data?.src ?? {};
        if (n.type === "condition") {
          const labels = Array.from(new Set(outLabels[n.id] || (data.branches || []).map((b: any) => b.label)));
          data = { ...data, mode: data.mode || "llm", prompt: data.prompt || "Classify the request.",
                   branches: labels.map((l) => ({ label: l })), default: data.default || labels[0] || null };
        }
        return { id: n.id, type: n.type, data,
                 position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } };
      }),
      edges: edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        data: e.data ?? {}, label: e.label ?? null,
      })),
    };
  }, [nodes, edges]);

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

  const saveSchedule = async () => {
    if (!wf) return;
    setSchedMsg("saving…");
    try {
      const updated = await api.updateWorkflow(wf.id, { schedule_cron: cron.trim() || null });
      setWf(updated);
      setSchedMsg(updated.schedule_cron ? `scheduled · ${updated.schedule_cron}` : "schedule cleared");
    } catch (e) {
      setSchedMsg(`failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  useEffect(() => { api.listWorkflows().then(setWorkflows).catch(() => {}); }, [run]);

  const deleteWorkflow = async (id: string, name: string) => {
    if (!window.confirm(`Delete workflow "${name}"? This permanently removes it and its runs.`)) return;
    try {
      await api.deleteWorkflow(id);
      setWorkflows((ws) => ws.filter((w) => w.id !== id));
      if (wf?.id === id) { setWf(null); }   // if the open one was deleted, drop back to the list
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  useEffect(() => {
    if (!workflowId) return;
    (async () => {
      const w = await api.getWorkflow(workflowId);
      const ids = (w.graph_json?.nodes ?? []).filter((n) => n.data?.agent_id).map((n) => n.data.agent_id);
      const allAgents = await api.listAgents().catch(() => []);
      setAgents(allAgents);
      const byId: Record<string, Agent> = {};
      allAgents.forEach((a) => { if (ids.includes(a.id)) byId[a.id] = a; });
      const rf = buildRF(w.graph_json, byId);
      setWf(w); setNodes(rf.nodes); setEdges(rf.edges);
      setCron(w.schedule_cron ?? ""); setSchedMsg("");
      setEvents([]); setRun(null); setHud({ tokens: 0, cost: 0, status: "" });
    })();
    return () => wsRef.current?.close();
  }, [workflowId]);

  const markNode = useCallback((id: string, status: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, status } } : n)));
  }, [setNodes]);

  // Answer a human-approval interrupt from the console (resumes the same run;
  // the open WebSocket keeps streaming the continued run's events).
  const sendReply = async () => {
    if (!run || !reply.trim()) return;
    setHud((h) => ({ ...h, status: "running" }));
    await api.resumeRun(run.id, reply.trim());
    setReply("");
  };

  const start = async () => {
    if (!wf) return;
    setMonitor((m) => (m === "closed" ? "normal" : m)); // make sure the log is visible
    setEvents([]); setHud({ tokens: 0, cost: 0, status: "running" });
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: "idle" } })));
    const r = await api.createRun(wf.id, message);
    setRun(r);
    wsRef.current?.close();
    wsRef.current = openRunSocket(r.id, (e) => {
      setEvents((prev) => [...prev, e]);
      if (e.type === "node_enter" && e.data?.node_id) markNode(e.data.node_id, "running");
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
        <div className="flex items-center justify-between">
          <h1 className="font-disp text-2xl font-semibold">Workflows</h1>
          <Button variant="primary" onClick={async () => {
            const w = await api.createWorkflow({
              name: `Workflow ${new Date().toISOString().slice(11, 19)}`,
              graph_json: {
                nodes: [
                  { id: "start", type: "start", data: {}, position: { x: 80, y: 220 } },
                  { id: "end", type: "end", data: {}, position: { x: 640, y: 220 } },
                ],
                edges: [],
              },
            });
            onOpen(w.id);
          }}>＋ New workflow</Button>
        </div>
        <p className="mt-1 text-t2">Describe a workflow and let AI build it, start from scratch, or open one below.</p>

        {/* Natural-language / voice workflow generation */}
        <Panel className="mt-6 p-5">
          <div className="flex items-center gap-2">
            <span className="font-disp text-base">✨ Describe your workflow</span>
            <span className="font-mono text-[10px] text-t2">— AI designs the agents + graph; speak or type</span>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <textarea
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
              placeholder="e.g. Triage a customer message; route refunds to a refund agent that can issue payments, and questions to an FAQ agent that uses the knowledge base."
              className="h-20 flex-1 resize-none rounded-lg border border-line2 bg-bg1 px-3 py-2 text-sm text-t0 outline-none focus:border-mint/50"
            />
            <div className="flex flex-col gap-2">
              {(recordingSupported() || voiceSupported()) && (
                <button
                  onClick={toggleVoice}
                  disabled={transcribing}
                  title={listening ? "Stop & transcribe (ElevenLabs Scribe)" : "Speak your workflow (ElevenLabs Scribe)"}
                  className={`grid h-10 w-10 place-items-center rounded-lg border text-lg ${
                    listening ? "border-coral/50 bg-coral/10 text-coral animate-pulse" : "border-line2 text-t1 hover:text-t0"}`}
                >{transcribing ? "…" : listening ? "■" : "🎙"}</button>
              )}
              <Button variant="primary" onClick={generate} disabled={genBusy || !genPrompt.trim()}>
                {genBusy ? "Designing…" : "Generate"}
              </Button>
            </div>
          </div>
          {listening && <div className="mt-2 font-mono text-[11px] text-coral">● recording… speak now, then tap ■ to transcribe with ElevenLabs</div>}
          {transcribing && <div className="mt-2 font-mono text-[11px] text-cyan">◌ transcribing with ElevenLabs Scribe…</div>}
          {genErr && <div className="mt-2 font-mono text-[11px] text-coral">{genErr}</div>}
        </Panel>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((w) => (
            <Panel key={w.id} className="p-4 hover:border-line2" >
              <div className="flex items-start justify-between gap-2">
                <div className="font-disp text-base">{w.name}</div>
                <button title="Delete workflow" onClick={() => deleteWorkflow(w.id, w.name)}
                  className="shrink-0 text-t3 transition hover:text-coral">🗑</button>
              </div>
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
    <div className="flex h-full overflow-hidden">
      <div className="relative min-w-0 flex-1">
        <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
          <span className="font-disp text-sm">{wf.name}</span>
          <input value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-96 rounded-lg border border-line2 bg-bg1/90 px-3 py-1.5 text-sm outline-none focus:border-mint/50" />
          <Button variant="primary" onClick={start} disabled={hud.status === "running"}>▶ Run</Button>
          <Button onClick={save}>Save</Button>
          <Button onClick={validate}>Validate</Button>
          <Button onClick={explainWf} disabled={explainBusy}>{explainBusy ? "Explaining…" : "💬 Explain"}</Button>
          <Button onClick={() => deleteWorkflow(wf.id, wf.name)}>🗑 Delete</Button>
          {wf.schedule_cron && <Pill tone="mint">⏱ {wf.schedule_cron}</Pill>}
          {hud.status && <Pill tone={statusTone(hud.status)}>● {hud.status}</Pill>}
          {editStatus && <span className="font-mono text-[11px] text-t2">{editStatus}</span>}
        </div>

        {/* Explain-this-workflow (plain English) + read aloud (ElevenLabs TTS) */}
        {explain && (
          <div className="absolute right-4 top-16 z-20 w-80 rounded-xl border border-line bg-bg2/95 p-4 shadow-glow backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-disp text-sm">💬 What this workflow does</span>
              <button onClick={() => setExplain(null)} className="text-t3 hover:text-coral">✕</button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-t1">{explain}</p>
            <div className="mt-3">
              <Button onClick={() => speakText(explain)} disabled={speaking}>
                {speaking ? "🔊 Speaking…" : "🔊 Read aloud"}
              </Button>
            </div>
          </div>
        )}

        {/* Add-node palette */}
        <div className="absolute left-4 top-16 z-10 flex flex-col gap-1.5 rounded-xl border border-line bg-bg2/85 p-2 backdrop-blur">
          <span className="px-1 font-mono text-[9px] uppercase tracking-wider text-t2">Add node</span>
          <select
            value=""
            onChange={(e) => { if (e.target.value) { addNode("agent", e.target.value); e.currentTarget.value = ""; } }}
            className="rounded-md border border-line2 bg-bg1 px-2 py-1 text-[11px] text-t0 outline-none">
            <option value="">＋ Agent…</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {[["condition", "＋ Condition"], ["human", "✋ Human approval"], ["tool", "＋ Tool"], ["start", "＋ Start"], ["end", "＋ End"]].map(([t, lbl]) => (
            <button key={t} onClick={() => addNode(t)}
              className="rounded-md border border-line2 px-2 py-1 text-left text-[11px] text-t1 hover:bg-bg3 hover:text-t0">
              {lbl}
            </button>
          ))}
          <span className="px-1 pt-1 font-mono text-[8px] text-t3">⌫ deletes selected</span>

          <div className="mt-1 flex flex-col gap-1.5 border-t border-line pt-2">
            <span className="px-1 font-mono text-[9px] uppercase tracking-wider text-t2">⏱ Schedule (cron)</span>
            <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 9 * * *  (blank = off)"
              className="rounded-md border border-line2 bg-bg1 px-2 py-1 font-mono text-[10px] text-t0 outline-none focus:border-mint/50" />
            <div className="flex flex-wrap gap-1">
              {[["0 9 * * *", "9am"], ["0 * * * *", "hourly"], ["*/15 * * * *", "15m"]].map(([expr, lbl]) => (
                <button key={expr} onClick={() => setCron(expr)}
                  className="rounded border border-line2 px-1.5 py-0.5 font-mono text-[9px] text-t1 hover:border-mint/40 hover:text-mint">{lbl}</button>
              ))}
            </div>
            <button onClick={saveSchedule}
              className="rounded-md grad px-2 py-1 text-[11px] font-bold text-white shadow-glow">Set schedule</button>
            {schedMsg && <span className="px-1 font-mono text-[9px] text-t2">{schedMsg}</span>}
          </div>
        </div>

        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          deleteKeyCode={["Backspace", "Delete"]}
          nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ style: { stroke: "rgba(20,24,28,.18)", strokeWidth: 2 } }}>
          <Background variant={BackgroundVariant.Dots} gap={26} size={1.1} color="rgba(20,24,28,.12)" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {monitor === "closed" && (
          <button onClick={() => setMonitor("normal")}
            className="absolute right-3 top-3 z-10 rounded-lg border border-line2 bg-bg2/90 px-3 py-1.5 text-xs text-t1 backdrop-blur hover:text-t0">
            ⠿ Show activity log
          </button>
        )}
      </div>

      {monitor !== "closed" && (
        <Panel style={{ width: monitor === "wide" ? 720 : 400 }}
          className="m-3 flex min-h-0 shrink-0 flex-col overflow-hidden">
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-disp text-sm">Live Activity Log</div>
              <div className="font-mono text-[10px] text-t2">agent replies · tool calls · tokens · cost — streamed live over WebSocket</div>
            </div>
            <button title={monitor === "wide" ? "Shrink panel" : "Expand panel"}
              onClick={() => setMonitor(monitor === "wide" ? "normal" : "wide")}
              className="rounded-md border border-line2 px-2 py-1 text-[11px] text-t1 hover:bg-bg3 hover:text-t0">
              {monitor === "wide" ? "⤡ Shrink" : "⤢ Expand"}
            </button>
            <button title="Hide panel" onClick={() => setMonitor("closed")}
              className="rounded-md border border-line2 px-2 py-1 text-[11px] text-t1 hover:text-coral">✕</button>
          </header>

          <div className="grid grid-cols-3 gap-2 border-b border-line px-4 py-3">
            <div><div className="font-mono text-[10px] text-t2">status</div><div className="font-mono text-sm text-mint">{hud.status || "idle"}</div></div>
            <div><div className="font-mono text-[10px] text-t2">tokens</div><div className="font-mono text-sm text-mint">{hud.tokens.toLocaleString()}</div></div>
            <div><div className="font-mono text-[10px] text-t2">cost</div><div className="font-mono text-sm text-mint">${hud.cost.toFixed(4)}</div></div>
          </div>

          {/* Voice-back: speak the final agent answer aloud (ElevenLabs TTS). */}
          {(() => {
            const last = [...events].reverse().find((e) => e.type === "agent_message")?.data?.content;
            return last ? (
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
                <span className="font-mono text-[10px] text-t2">final answer</span>
                <button onClick={() => speakText(String(last))} disabled={speaking}
                  className="rounded-md border border-line2 px-2 py-1 text-[11px] text-t1 hover:border-mint/40 hover:text-mint">
                  {speaking ? "🔊 Speaking…" : "🔊 Read result aloud"}
                </button>
              </div>
            ) : null;
          })()}

          {hud.status === "waiting_human" && (
            <div className="border-b border-coral/30 bg-coral/5 px-4 py-3">
              <div className="font-disp text-[13px] text-coral">✋ Human approval needed</div>
              <div className="mt-0.5 whitespace-pre-wrap text-[12px] text-t1">
                {[...events].reverse().find((e) => e.type === "interrupt")?.data?.value || "Reply to continue the run."}
              </div>
              <div className="mt-2 flex gap-2">
                <input value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
                  placeholder="Type 'ok' to approve, or give instructions…"
                  className="flex-1 rounded-lg border border-line2 bg-bg1 px-3 py-1.5 text-sm outline-none focus:border-mint/50" />
                <Button variant="primary" onClick={sendReply} disabled={!reply.trim()}>Send reply</Button>
              </div>
              <div className="mt-1.5 font-mono text-[10px] text-t2">…or reply in Telegram if a bot is connected to this workflow.</div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {events.length === 0 ? (
              <div className="mt-6 text-center text-sm text-t2">
                <div className="text-2xl">⠿</div>
                <p className="mt-2">Press <span className="text-mint">▶ Run</span> to watch agents work here —<br />
                  each message, tool call, token and cost appears live.</p>
              </div>
            ) : (
              <div className="relative border-l border-line2 pl-4">
                {events.map((e, i) => {
                  const d = describeEvent(e);
                  return (
                    <div key={i} className="relative py-2">
                      <span className={`absolute -left-[21px] top-2.5 h-2.5 w-2.5 rounded-full ${DOT[d.tone] || "bg-t3"}`} />
                      <div className="text-[12.5px] font-medium text-t0">{d.icon} {d.title}</div>
                      {d.detail && (
                        <div className="mt-0.5 whitespace-pre-wrap break-words text-[12px] text-t1">
                          {String(d.detail).slice(0, monitor === "wide" ? 600 : 240)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
