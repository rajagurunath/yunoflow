import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Agent, ToolSpec } from "../lib/types";
import { Button, Panel, Pill } from "../components/ui";

const EMPTY = { name: "", role: "", model: "", system_prompt: "", tools: [] as string[] };

export function AgentStudio() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<ToolSpec[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const refresh = () => api.listAgents().then(setAgents).catch(() => {});
  useEffect(() => { refresh(); api.tools().then(setTools).catch(() => {}); }, []);

  const toggleTool = (name: string) =>
    setForm((f) => ({ ...f, tools: f.tools.includes(name) ? f.tools.filter((t) => t !== name) : [...f.tools, name] }));

  const create = async () => {
    if (!form.name || !form.model) return;
    setSaving(true);
    try { await api.createAgent(form); setForm({ ...EMPTY }); await refresh(); }
    finally { setSaving(false); }
  };

  const input = "w-full rounded-lg border border-line2 bg-bg1 px-3 py-2 text-sm text-t0 outline-none focus:border-mint/50";

  return (
    <div className="grid h-full grid-cols-[1fr_360px] overflow-hidden">
      <div className="overflow-auto p-8">
        <h1 className="font-disp text-2xl font-semibold">Agents</h1>
        <p className="mt-1 text-t2">{agents.length} configured · up to 14 dimensions each.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {agents.map((a) => (
            <Panel key={a.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-disp text-base">{a.name}</div>
                  <div className="font-mono text-[11px] text-t2">{a.model} · {a.role}</div>
                </div>
                <button onClick={async () => { await api.deleteAgent(a.id); refresh(); }}
                  className="text-t3 hover:text-coral" title="Delete">✕</button>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-t1">{a.system_prompt || "—"}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.tools.map((t) => <Pill key={t} tone="cyan">{t}</Pill>)}
                {a.channels.map((c) => <Pill key={c} tone="amber">{c}</Pill>)}
              </div>
            </Panel>
          ))}
        </div>
      </div>

      <Panel className="m-4 flex flex-col gap-3 overflow-auto p-5">
        <div className="font-disp text-lg">New agent</div>
        <input className={input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={input} placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        <input className={input} placeholder="Model (e.g. your LLM_MODEL)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        <textarea className={`${input} h-24 resize-none`} placeholder="System prompt" value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} />
        <div>
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-t2">Tools</div>
          <div className="flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <button key={t.name} onClick={() => toggleTool(t.name)}
                className={`rounded-md border px-2 py-1 font-mono text-[10px] ${
                  form.tools.includes(t.name) ? "border-mint/40 bg-mint/10 text-mint" : "border-line2 text-t1"}`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={create} disabled={saving || !form.name || !form.model}>
          {saving ? "Saving…" : "Create agent"}
        </Button>
      </Panel>
    </div>
  );
}
