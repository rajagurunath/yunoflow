import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ChannelBinding, Workflow } from "../lib/types";
import { Button, Panel, Pill } from "../components/ui";

export function ChannelsView() {
  const [status, setStatus] = useState<Record<string, any>>({});
  const [bindings, setBindings] = useState<ChannelBinding[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  // "Connect a bot" form
  const [wfId, setWfId] = useState("");
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = () => {
    api.channelStatus().then(setStatus).catch(() => {});
    api.listChannels().then(setBindings).catch(() => {});
  };
  useEffect(() => {
    refresh();
    api.listWorkflows().then((w) => { setWorkflows(w); if (w[0]) setWfId(w[0].id); }).catch(() => {});
  }, []);

  const connect = async () => {
    if (!wfId) return;
    setBusy(true); setErr(null); setOk(null);
    try {
      const b = await api.createChannel({
        channel_type: "telegram", workflow_id: wfId,
        bot_token: token.trim() || undefined, label: label.trim() || undefined,
      });
      setOk(b.has_token
        ? `Connected @${b.bot_username} → ${wfName(b.workflow_id)}`
        : `Bound ${wfName(b.workflow_id)} to the default bot`);
      setToken(""); setLabel("");
      refresh();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const tg = status.telegram || { running: false };
  const botStatus = status.bindings || {};
  const wfName = (id: string | null) => workflows.find((w) => w.id === id)?.name ?? id ?? "—";
  const input = "rounded-lg border border-line2 bg-bg1 px-3 py-2 text-sm text-t0 outline-none focus:border-mint/50";

  return (
    <div className="h-full overflow-auto p-8">
      <h1 className="font-disp text-2xl font-semibold">Channels</h1>
      <p className="mt-1 text-t2">Talk to your workflows over Telegram — share the default bot, or give a workflow its own.</p>

      {/* Default (shared) bot */}
      <Panel className="mt-6 flex items-center gap-3 p-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gold/15 text-gold">✈</div>
        <div className="min-w-0">
          <div className="font-disp text-base">Default bot <span className="font-mono text-[11px] text-t2">· shared by all workflows</span></div>
          <div className="font-mono text-[11px] text-t2">
            {tg.running ? `live · @${tg.bot_username ?? "bot"}` : "not connected (set TELEGRAM_BOT_TOKEN in .env)"}
          </div>
        </div>
        <Pill tone={tg.running ? "mint" : "t1"}>{tg.running ? "● running" : "○ offline"}</Pill>
      </Panel>

      {/* Connect a bot */}
      <Panel className="mt-5 p-5">
        <div className="font-disp text-base">Connect a Telegram bot</div>
        <p className="mt-1 text-sm text-t2">
          Create a bot with <a className="text-mint hover:underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>,
          copy the token it gives you, and connect it to a workflow. Leave the token blank to route a
          workflow through the shared default bot instead.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-t2">Workflow</span>
            <select className={input} value={wfId} onChange={(e) => setWfId(e.target.value)}>
              {workflows.length === 0 && <option value="">no workflows — create one first</option>}
              {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-t2">Label <span className="normal-case text-t3">(optional)</span></span>
            <input className={input} value={label} placeholder="e.g. Refunds bot"
              onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-t2">Bot token <span className="normal-case text-t3">(optional — leave blank to use the default bot)</span></span>
            <input className={`${input} font-mono`} value={token} type="password" autoComplete="off"
              placeholder="123456789:AA…  (from @BotFather)"
              onChange={(e) => setToken(e.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" onClick={connect} disabled={busy || !wfId}>
            {busy ? "Connecting…" : token.trim() ? "＋ Connect bot" : "＋ Bind to default bot"}
          </Button>
          {err && <span className="font-mono text-[11px] text-coral">{err}</span>}
          {ok && <span className="font-mono text-[11px] text-mint">{ok}</span>}
        </div>
      </Panel>

      <h2 className="mt-8 font-disp text-lg">Connected bots & bindings</h2>
      <div className="mt-3 flex flex-col gap-2">
        {bindings.map((b) => {
          const dedicated = b.has_token;
          const running = dedicated ? !!botStatus[b.id]?.running : tg.running;
          const uname = dedicated ? (botStatus[b.id]?.bot_username ?? b.bot_username) : (tg.bot_username);
          return (
            <Panel key={b.id} className="flex flex-wrap items-center gap-3 p-3">
              <Pill tone="gold">telegram</Pill>
              <span className="text-sm text-t0">
                {dedicated
                  ? <>{b.label || "Dedicated bot"} {uname && <span className="font-mono text-[11px] text-t2">@{uname}</span>}</>
                  : <span className="text-t2">default bot</span>}
              </span>
              <span className="text-sm text-t1">→ {wfName(b.workflow_id)}</span>
              {!dedicated && (
                <span className="font-mono text-[10px] text-t2">{b.external_chat_id ? `chat ${b.external_chat_id}` : "any chat"}</span>
              )}
              <Pill tone={running ? "mint" : "t1"}>{running ? "● running" : "○ offline"}</Pill>
              <button className="ml-auto text-t3 hover:text-coral" title="Remove"
                onClick={async () => { await api.deleteChannel(b.id); refresh(); }}>✕</button>
            </Panel>
          );
        })}
        {bindings.length === 0 && (
          <div className="text-sm text-t2">No bindings yet — the default bot runs the demo workflow until you connect one.</div>
        )}
      </div>
    </div>
  );
}
