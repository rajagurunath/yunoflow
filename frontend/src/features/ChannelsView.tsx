import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ChannelBinding, Workflow } from "../lib/types";
import { Button, Panel, Pill } from "../components/ui";

export function ChannelsView() {
  const [status, setStatus] = useState<Record<string, any>>({});
  const [bindings, setBindings] = useState<ChannelBinding[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [wfId, setWfId] = useState("");

  const refresh = () => {
    api.channelStatus().then(setStatus).catch(() => {});
    api.listChannels().then(setBindings).catch(() => {});
  };
  useEffect(() => {
    refresh();
    api.listWorkflows().then((w) => { setWorkflows(w); if (w[0]) setWfId(w[0].id); }).catch(() => {});
  }, []);

  const bind = async () => {
    if (!wfId) return;
    await api.createChannel({ channel_type: "telegram", workflow_id: wfId });
    refresh();
  };

  const tg = status.telegram || { running: false };
  const wfName = (id: string | null) => workflows.find((w) => w.id === id)?.name ?? id ?? "—";
  const input = "rounded-lg border border-line2 bg-bg1 px-3 py-2 text-sm text-t0 outline-none focus:border-mint/50";

  return (
    <div className="h-full overflow-auto p-8">
      <h1 className="font-disp text-2xl font-semibold">Channels</h1>
      <p className="mt-1 text-t2">Connect a workflow to an external messaging channel.</p>

      <Panel className="mt-6 flex items-center gap-3 p-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gold/15 text-gold">✈</div>
        <div>
          <div className="font-disp text-base">Telegram</div>
          <div className="font-mono text-[11px] text-t2">
            {tg.running ? `live · @${tg.bot_username ?? "bot"}` : "not connected (set TELEGRAM_BOT_TOKEN)"}
          </div>
        </div>
        <Pill tone={tg.running ? "mint" : "t1"}>{tg.running ? "● running" : "○ offline"}</Pill>
      </Panel>

      <Panel className="mt-5 flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[11px] uppercase tracking-wide text-t2">Bind workflow → Telegram</label>
          <select className={input} value={wfId} onChange={(e) => setWfId(e.target.value)}>
            {workflows.length === 0 && <option value="">no workflows — create one first</option>}
            {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <Button variant="primary" onClick={bind} disabled={!wfId}>＋ Bind</Button>
      </Panel>

      <h2 className="mt-8 font-disp text-lg">Bindings</h2>
      <div className="mt-3 flex flex-col gap-2">
        {bindings.map((b) => (
          <Panel key={b.id} className="flex items-center gap-3 p-3">
            <Pill tone="gold">{b.channel_type}</Pill>
            <span className="text-sm text-t1">→ {wfName(b.workflow_id)}</span>
            <span className="font-mono text-[10px] text-t2">{b.external_chat_id ? `chat ${b.external_chat_id}` : "default (any chat)"}</span>
            <Pill tone={b.active ? "mint" : "t1"}>{b.active ? "active" : "inactive"}</Pill>
            <button className="ml-auto text-t3 hover:text-coral" title="Remove"
              onClick={async () => { await api.deleteChannel(b.id); refresh(); }}>✕</button>
          </Panel>
        ))}
        {bindings.length === 0 && (
          <div className="text-sm text-t2">No bindings — the bot runs the demo workflow until you bind one.</div>
        )}
      </div>
    </div>
  );
}
