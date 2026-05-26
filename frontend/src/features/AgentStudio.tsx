import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Agent, ToolSpec } from "../lib/types";
import { Button, Panel, Pill } from "../components/ui";

type Draft = Omit<Agent, "id">;

const CHANNELS = ["telegram"];
const CRON_PRESETS: [string, string][] = [
  ["0 9 * * *", "Daily 9am"],
  ["0 * * * *", "Hourly"],
  ["*/15 * * * *", "Every 15m"],
  ["0 9 * * 1", "Weekly Mon"],
];

const blank = (model = ""): Draft => ({
  name: "", role: "", system_prompt: "", model,
  temperature: 0.7, top_p: 1.0,
  tools: [], channels: [], schedule_cron: "",
  memory: { mode: "window", window_size: 10, summarize: false },
  skills: [], interaction_rules: "",
  guardrails: { max_steps: 12, max_tokens: 20000, max_cost_usd: 0.5, allowed_tools: [] },
  personality: { tone: "professional", traits: [] },
});

const csv = (xs: string[]) => xs.join(", ");
const parseCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function AgentStudio() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<ToolSpec[]>([]);
  const [form, setForm] = useState<Draft>(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => api.listAgents().then(setAgents).catch(() => {});
  useEffect(() => { refresh(); api.tools().then(setTools).catch(() => {}); }, []);

  const set = (patch: Partial<Draft>) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (key: "tools" | "channels", name: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(name) ? f[key].filter((t) => t !== name) : [...f[key], name] }));

  const startNew = () => { setEditingId(null); setForm(blank(agents[0]?.model || "")); };
  const edit = (a: Agent) => {
    setEditingId(a.id);
    const { id, ...rest } = a;
    setForm({ ...rest, schedule_cron: a.schedule_cron ?? "" });
  };

  const save = async () => {
    if (!form.name || !form.model) return;
    setSaving(true);
    try {
      const payload = { ...form, schedule_cron: (form.schedule_cron || "").trim() || null };
      if (editingId) await api.updateAgent(editingId, payload);
      else await api.createAgent(payload);
      await refresh();
      startNew();
    } finally { setSaving(false); }
  };

  const input = "w-full rounded-lg border border-line2 bg-bg1 px-3 py-2 text-sm text-t0 outline-none focus:border-mint/50";

  return (
    <div className="grid h-full grid-cols-[1fr_440px] overflow-hidden">
      {/* roster */}
      <div className="overflow-auto p-8">
        <h1 className="font-disp text-2xl font-semibold">Agents</h1>
        <p className="mt-1 text-t2">{agents.length} configured · 14 dimensions each · click a card to edit.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {agents.map((a) => (
            <Panel key={a.id}
              onClick={() => edit(a)}
              className={`cursor-pointer p-4 transition hover:border-line2 ${editingId === a.id ? "border-mint/50" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-disp text-base">{a.name}</div>
                  <div className="truncate font-mono text-[11px] text-t2">{a.model} · {a.role}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); api.deleteAgent(a.id).then(refresh); }}
                  className="text-t3 hover:text-coral" title="Delete">✕</button>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-t1">{a.system_prompt || "—"}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.tools.map((t) => <Pill key={t} tone="cyan">{t}</Pill>)}
                {a.channels.map((c) => <Pill key={c} tone="amber">{c}</Pill>)}
                {a.schedule_cron && <Pill tone="mint">⏱ {a.schedule_cron}</Pill>}
                {a.personality?.tone && <Pill>◐ {a.personality.tone}</Pill>}
              </div>
            </Panel>
          ))}
          {agents.length === 0 && <div className="text-t2">No agents yet — create one on the right.</div>}
        </div>
      </div>

      {/* config form */}
      <Panel className="m-4 flex flex-col gap-3 overflow-auto p-5">
        <div className="flex items-center justify-between">
          <div className="font-disp text-lg">{editingId ? "Edit agent" : "New agent"}</div>
          {editingId && (
            <button onClick={startNew} className="rounded-md border border-line2 px-2 py-1 text-[11px] text-t1 hover:text-t0">
              ＋ New
            </button>
          )}
        </div>

        <Section title="Identity">
          <Field label="Name"><input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Role"><input className={input} value={form.role} placeholder="e.g. payments support triage" onChange={(e) => set({ role: e.target.value })} /></Field>
          <Field label="Model"><input className={input} value={form.model} placeholder="your LLM_MODEL" onChange={(e) => set({ model: e.target.value })} /></Field>
        </Section>

        <Section title="Behavior">
          <Field label="System prompt"><textarea className={`${input} h-24 resize-none`} value={form.system_prompt} onChange={(e) => set({ system_prompt: e.target.value })} /></Field>
          <Field label="Interaction rules"><textarea className={`${input} h-16 resize-none`} value={form.interaction_rules} placeholder="e.g. always confirm before issuing a refund" onChange={(e) => set({ interaction_rules: e.target.value })} /></Field>
        </Section>

        <Section title="Personality">
          <Field label="Tone"><input className={input} value={form.personality.tone} onChange={(e) => set({ personality: { ...form.personality, tone: e.target.value } })} /></Field>
          <Field label="Traits (comma-separated)"><input className={input} value={csv(form.personality.traits)} placeholder="concise, empathetic" onChange={(e) => set({ personality: { ...form.personality, traits: parseCsv(e.target.value) } })} /></Field>
          <Field label="Skills (comma-separated)"><input className={input} value={csv(form.skills)} placeholder="refunds, kb-lookup" onChange={(e) => set({ skills: parseCsv(e.target.value) })} /></Field>
        </Section>

        <Section title="Sampling">
          <Slider label="Temperature" min={0} max={2} step={0.1} value={form.temperature} onChange={(v) => set({ temperature: v })} />
          <Slider label="Top-p" min={0} max={1} step={0.05} value={form.top_p} onChange={(v) => set({ top_p: v })} />
        </Section>

        <Section title="Memory">
          <Field label="Mode">
            <select className={input} value={form.memory.mode} onChange={(e) => set({ memory: { ...form.memory, mode: e.target.value } })}>
              <option value="none">none</option><option value="window">window</option><option value="persistent">persistent</option>
            </select>
          </Field>
          {form.memory.mode === "window" && (
            <Field label="Window size"><input type="number" min={1} className={input} value={form.memory.window_size} onChange={(e) => set({ memory: { ...form.memory, window_size: +e.target.value } })} /></Field>
          )}
          <label className="flex items-center gap-2 text-sm text-t1">
            <input type="checkbox" checked={form.memory.summarize} onChange={(e) => set({ memory: { ...form.memory, summarize: e.target.checked } })} />
            Summarize older turns
          </label>
        </Section>

        <Section title="Tools">
          <Chips options={tools.map((t) => t.name)} selected={form.tools} onToggle={(n) => toggle("tools", n)} />
        </Section>

        <Section title="Channels">
          <Chips options={CHANNELS} selected={form.channels} onToggle={(n) => toggle("channels", n)} tone="amber" />
        </Section>

        <Section title="Schedule (cron)">
          <Field label="Cron expression">
            <input className={`${input} font-mono`} value={form.schedule_cron ?? ""} placeholder="0 9 * * *  (blank = none)"
              onChange={(e) => set({ schedule_cron: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {CRON_PRESETS.map(([expr, label]) => (
              <button key={expr} onClick={() => set({ schedule_cron: expr })}
                className="rounded-md border border-line2 px-2 py-1 font-mono text-[10px] text-t1 hover:border-mint/40 hover:text-mint">
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Guardrails">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Max steps"><input type="number" className={input} value={form.guardrails.max_steps} onChange={(e) => set({ guardrails: { ...form.guardrails, max_steps: +e.target.value } })} /></Field>
            <Field label="Max tokens"><input type="number" className={input} value={form.guardrails.max_tokens} onChange={(e) => set({ guardrails: { ...form.guardrails, max_tokens: +e.target.value } })} /></Field>
            <Field label="Max $"><input type="number" step="0.05" className={input} value={form.guardrails.max_cost_usd} onChange={(e) => set({ guardrails: { ...form.guardrails, max_cost_usd: +e.target.value } })} /></Field>
          </div>
        </Section>

        <Button variant="primary" onClick={save} disabled={saving || !form.name || !form.model}>
          {saving ? "Saving…" : editingId ? "Save changes" : "Create agent"}
        </Button>
      </Panel>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-t2">{title}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-t2">{label}</span>
      {children}
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-[11px] text-t2">{label}<span className="font-mono text-t1">{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} className="accent-mint" />
    </label>
  );
}

function Chips({ options, selected, onToggle, tone = "mint" }: {
  options: string[]; selected: string[]; onToggle: (n: string) => void; tone?: "mint" | "amber";
}) {
  const on = tone === "amber" ? "border-amber/40 bg-amber/10 text-amber" : "border-mint/40 bg-mint/10 text-mint";
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.length === 0 && <span className="text-[11px] text-t3">none available</span>}
      {options.map((n) => (
        <button key={n} onClick={() => onToggle(n)}
          className={`rounded-md border px-2 py-1 font-mono text-[10px] ${selected.includes(n) ? on : "border-line2 text-t1"}`}>
          {n}
        </button>
      ))}
    </div>
  );
}
