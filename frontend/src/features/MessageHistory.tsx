import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Message, MetricsSummary, Run } from "../lib/types";
import { Panel, Pill, statusTone } from "../components/ui";

const ROLE: Record<string, string> = {
  user: "border-cyan/40 text-cyan",
  assistant: "border-mint/40 text-mint",
  tool: "border-gold/40 text-gold",
  system: "border-line2 text-t2",
};

export function MessageHistory() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.listRuns().then(setRuns).catch((e) => setErr(String(e))); }, []);
  useEffect(() => { api.metrics().then(setMetrics).catch(() => {}); }, []);
  useEffect(() => { if (sel) api.runMessages(sel).then(setMessages).catch(() => {}); }, [sel]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MetricsStrip m={metrics} />
      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] overflow-hidden">
      <div className="overflow-auto border-r border-line p-4">
        <h1 className="font-disp text-lg">Runs</h1>
        <p className="mt-1 text-xs text-t2">Persisted message history.</p>
        {err && <p className="mt-2 font-mono text-xs text-coral">{err}</p>}
        <div className="mt-4 flex flex-col gap-2">
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSel(r.id)}
              className={`rounded-lg border p-3 text-left transition ${
                sel === r.id ? "border-mint/40 bg-mint/5" : "border-line hover:border-line2"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-t1">{r.id.slice(0, 8)}</span>
                <Pill tone={statusTone(r.status)}>{r.status}</Pill>
              </div>
              <div className="mt-1 font-mono text-[10px] text-t2">
                {r.total_tokens.toLocaleString()} tok · ${r.total_cost_usd.toFixed(4)}
              </div>
            </button>
          ))}
          {runs.length === 0 && <div className="text-sm text-t2">No runs yet — run a workflow.</div>}
        </div>
      </div>

      <div className="overflow-auto p-6">
        {!sel && <div className="text-t2">Select a run to view its transcript.</div>}
        {sel && (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((m) => (
              <Panel key={m.id} className="p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${ROLE[m.role] || ROLE.system}`}>
                    {m.role}
                  </span>
                  {m.node_id && <span className="font-mono text-[10px] text-t2">@{m.node_id}</span>}
                  {m.channel !== "internal" && <Pill tone="gold">{m.channel}</Pill>}
                  {m.tokens > 0 && <span className="ml-auto font-mono text-[10px] text-t3">{m.tokens} tok</span>}
                </div>
                <div className="whitespace-pre-wrap text-sm text-t1">{m.content}</div>
              </Panel>
            ))}
            {messages.length === 0 && <div className="text-t2">No messages for this run.</div>}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function MetricsStrip({ m }: { m: MetricsSummary | null }) {
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const tiles: [string, string, string][] = m ? [
    ["Completion rate", pct(m.completion_rate), `${m.runs_completed}/${m.runs_completed + m.runs_failed} runs`],
    ["Agent↔agent msgs", m.agent_messages.toLocaleString(), "delivered"],
    ["Total runs", String(m.runs_total), `${m.runs_running} active · ${m.runs_waiting} waiting`],
    ["Avg run", m.avg_run_seconds == null ? "—" : `${m.avg_run_seconds}s`, "end-to-end"],
    ["Tokens", m.tokens_total.toLocaleString(), `$${m.cost_total.toFixed(4)}`],
    ["Agents", String(m.agents), `${m.scheduled} scheduled`],
    ["Workflows", String(m.workflows), "built"],
    ["Config dims / agent", String(m.agent_dimensions), "tunable"],
  ] : [];
  return (
    <div className="flex items-stretch gap-px overflow-x-auto border-b border-line bg-bg2/40">
      <div className="flex shrink-0 items-center px-4 font-mono text-[10px] uppercase tracking-wider text-t3">
        impact<br />metrics
      </div>
      {tiles.map(([label, value, sub]) => (
        <div key={label} className="shrink-0 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-t2">{label}</div>
          <div className="font-disp text-xl text-t0">{value}</div>
          <div className="font-mono text-[10px] text-t3">{sub}</div>
        </div>
      ))}
      {!m && <div className="px-4 py-3 text-sm text-t3">loading metrics…</div>}
    </div>
  );
}
