import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { GraphJSON, Template } from "../lib/types";
import { Button, Panel, Pill } from "../components/ui";

function summarize(g: GraphJSON) {
  const agents = g.nodes.filter((n) => n.type === "agent" || n.type === "deepagent").length;
  const conditions = g.nodes.filter((n) => n.type === "condition").length;
  const idx: Record<string, number> = {};
  g.nodes.forEach((n, i) => (idx[n.id] = i));
  const cycle = g.edges.some((e) => idx[e.target] < idx[e.source]);
  return { agents, conditions, cycle };
}

export function TemplateGallery({ onOpen }: { onOpen: (id: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch((e) => setErr(String(e)));
  }, []);

  const use = async (t: Template) => {
    setBusy(t.id);
    try {
      const wf = await api.instantiate(t.id);
      onOpen(wf.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-8">
      <h1 className="font-disp text-2xl font-semibold">Templates</h1>
      <p className="mt-1 text-t2">One click from zero to a working multi-agent workflow.</p>
      {err && <p className="mt-4 font-mono text-sm text-coral">backend unreachable: {err}</p>}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => {
          const s = summarize(t.graph_json);
          return (
            <Panel key={t.id} className="flex flex-col p-5">
              <div className="font-disp text-lg">{t.name}</div>
              <p className="mt-1.5 flex-1 text-sm text-t1">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="mint">{s.agents} agents</Pill>
                {s.conditions > 0 && <Pill tone="amber">{s.conditions} conditions</Pill>}
                {s.cycle && <Pill tone="amber">↺ feedback loop</Pill>}
              </div>
              <div className="mt-4">
                <Button variant="primary" onClick={() => use(t)} disabled={busy === t.id}>
                  {busy === t.id ? "Creating…" : "Use template →"}
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
