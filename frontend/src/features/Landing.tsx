import { useEffect, useState } from "react";
import { OrchestrationDiagram } from "../components/OrchestrationDiagram";
import { PublicFooter, PublicNav, type PublicPage } from "../components/PublicChrome";

const CLIENTS = ["inDrive", "McDonald's", "Rappi", "Viva Aerobús", "Avianca"];

const LIFECYCLE = [
  { k: "Build", glyph: "✎", desc: "Design agents & multi-agent workflows visually — or generate them from a sentence." },
  { k: "Test", glyph: "⚑", desc: "Run on a real runtime with deterministic fakes; validate graphs before they ship." },
  { k: "Fine-tune", glyph: "❖", desc: "Refine prompts, tools, memory and guardrails from real interaction data." },
  { k: "Deploy", glyph: "⤴", desc: "Connect channels and go live — durable, observable, guardrailed." },
  { k: "Evolve", glyph: "↻", desc: "Watch live metrics, learn from feedback loops, and iterate as problems change." },
];

const STEPS = [
  { n: "01", t: "Describe it, or design it", d: "Type or speak what you need and Orchestra drafts the agents and the graph — or build it node-by-node on the visual canvas with conditions and feedback loops." },
  { n: "02", t: "Run on a real runtime", d: "Agents execute on a LangGraph runtime, call real tools, and communicate with each other — pausing for human input exactly when they need it." },
  { n: "03", t: "Connect your channels", d: "Bind a workflow to Telegram (Slack & WhatsApp next) so customers and ops teams talk to your agents conversationally, 24/7." },
  { n: "04", t: "Monitor, control & evolve", d: "Stream every message, token and dollar live. Enforce per-agent guardrails. Learn from outcomes and redeploy in minutes." },
];

const USE_CASES = [
  { t: "Payments support triage", d: "Classify and resolve billing questions in any language, over chat, around the clock.", glyph: "◎" },
  { t: "Dispute & chargeback investigation", d: "A deep agent gathers evidence, checks the ledger, and recommends refund / deny / escalate.", glyph: "❖" },
  { t: "Agentic payment authorization", d: "Risk-assess, step-up, and execute payments with AP2-style intent/cart/payment mandates.", glyph: "⛁" },
  { t: "Refund automation", d: "Verify duplicate charges and issue refunds with guardrails and a full audit trail.", glyph: "↩" },
  { t: "Operations copilots", d: "Internal agents that query systems, run checks, and draft the next action for your team.", glyph: "⚒" },
  { t: "Fraud step-up", d: "Route risky transactions to human-in-the-loop confirmation before anything moves.", glyph: "⚠" },
];

const CAPS = [
  ["Visual workflow builder", "Drag, connect, branch and loop. The canvas is the runnable graph."],
  ["Real agent runtime", "LangGraph StateGraph with persistence, memory and interrupt/resume."],
  ["Generate from a sentence", "Natural-language (and voice) → a working multi-agent workflow."],
  ["Tools + AP2 payments", "A real tool registry plus mandate-style payment tools, per-agent scoped."],
  ["Guardrails & cost control", "Max steps, tokens and dollars enforced per agent, every run."],
  ["Live monitoring", "Inter-agent messages, tokens and cost streamed over WebSocket."],
  ["Durable execution", "DBOS-backed workflows survive restarts; schedules keep agents on time."],
  ["Observability & interop", "MLflow tracing and A2A agent-card discovery, out of the box."],
];

// Dark "product preview" frame — light marketing showing the real dark console.
function ProductPreview({ caption }: { caption: string }) {
  return (
    <div className="rounded-2xl border border-vline2 bg-ink p-3 shadow-[0_40px_90px_-30px_rgba(20,24,28,.45)]">
      <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </span>
        <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-t2">{caption}</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-mint">
          <span className="h-1.5 w-1.5 rounded-full bg-mint soft-pulse" /> running
        </span>
      </div>
      <div className="rounded-xl bg-bg0 p-4">
        <OrchestrationDiagram />
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div><div className="font-mono text-[10px] text-t2">channels</div><div className="font-mono text-sm text-t0">Telegram</div></div>
          <div><div className="font-mono text-[10px] text-t2">runtime</div><div className="font-mono text-sm text-t0">LangGraph</div></div>
          <div><div className="font-mono text-[10px] text-t2">live cost</div><div className="font-mono text-sm text-mint">$0.0007</div></div>
        </div>
      </div>
    </div>
  );
}

export function Landing({ onNav, onSignIn }: { onNav: (p: PublicPage) => void; onSignIn: () => void }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => (s + 1) % LIFECYCLE.length), 1900);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicNav onNav={onNav} onSignIn={onSignIn} current="landing" />

      {/* Hero */}
      <section className="vault-glow relative overflow-hidden">
        <div className="bg-paper-grid absolute inset-0 opacity-70"
          style={{ maskImage: "radial-gradient(120% 90% at 50% 0%, #000 45%, transparent 100%)" } as any} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.02fr_1fr] lg:pt-24">
          <div>
            <div className="fade-up inline-flex items-center gap-2 rounded-full border border-vline2 bg-paper px-3 py-1 font-plex text-[11px] uppercase tracking-[0.18em] text-emerald"
              style={{ animationDelay: ".05s" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald soft-pulse" /> Agentic infrastructure for payments
            </div>
            <h1 className="fade-up mt-5 font-serif text-[2.7rem] font-semibold leading-[1.04] tracking-[-0.01em] md:text-[3.5rem]"
              style={{ animationDelay: ".12s" }}>
              Build, evolve, and ship the <em className="italic text-emerald-grad">AI agents</em> that run your payment operations.
            </h1>
            <p className="fade-up mt-6 max-w-xl text-lg leading-relaxed text-inkmut" style={{ animationDelay: ".2s" }}>
              Orchestra is the complete lifecycle platform for agentic systems — design multi-agent
              workflows, test them, fine-tune on your data, deploy to real channels, and watch them
              improve. Scale your operations faster than headcount.
            </p>
            <div className="fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: ".28s" }}>
              <button onClick={onSignIn}
                className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:-translate-y-px hover:bg-ink2">
                Open the console →
              </button>
              <a href="#how" className="rounded-lg border border-vline2 px-5 py-3 text-sm font-medium text-ink transition hover:bg-sand">
                See how it works
              </a>
            </div>
            <div className="fade-up mt-6 font-plex text-[11px] text-inkdim" style={{ animationDelay: ".34s" }}>
              Runs fully local · one command · demo login admin / orchestra
            </div>
          </div>

          <div className="fade-up" style={{ animationDelay: ".22s" }}>
            <ProductPreview caption="orchestra · payments support" />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-vline bg-sand">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-7 md:flex-row md:gap-10">
          <span className="font-plex text-[11px] uppercase tracking-wider text-inkdim">Built for the scale of</span>
          <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
            {CLIENTS.map((c) => <span key={c} className="font-serif text-lg font-medium text-inkmut">{c}</span>)}
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <Section id="lifecycle" eyebrow="One platform, the full lifecycle"
        title="From idea to evolving production agents."
        intro="Most tools stop at building. Orchestra carries an agent through its entire life — and keeps it improving as the problem changes.">
        <div className="relative mt-10">
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-vline md:block" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {LIFECYCLE.map((s, i) => {
              const on = i === stage;
              return (
                <div key={s.k} className="relative flex flex-col items-center text-center">
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl border text-xl transition-all duration-500 ${
                    on ? "scale-105 border-emerald bg-emerald text-paper shadow-[0_10px_30px_-8px_rgba(13,110,84,.5)]" : "border-vline2 bg-paper text-inkmut"}`}>
                    {s.glyph}
                  </div>
                  <div className={`mt-3 font-serif text-base ${on ? "text-ink" : "text-inkmut"}`}>{s.k}</div>
                  <div className="mt-1 text-[12.5px] leading-snug text-inkmut">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section id="how" eyebrow="How it works"
        title="Describe a workflow. Watch it run. Keep it improving."
        intro="Every component is in the box — channels, agents, routers, tools, a real runtime and a live monitor.">
        <div className="mt-8"><ProductPreview caption="live workflow · payments support triage" /></div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-vline bg-paper p-6 transition hover:border-vline2 hover:shadow-[0_18px_40px_-24px_rgba(20,24,28,.3)]">
              <div className="flex items-baseline gap-3">
                <span className="font-plex text-sm text-emerald">{s.n}</span>
                <h3 className="font-serif text-lg text-ink">{s.t}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-inkmut">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Use cases */}
      <Section id="usecases" eyebrow="For payments teams"
        title="Put agents on your hardest operational flows."
        intro="Support, disputes, refunds, authorization and fraud — automated with guardrails, audited end to end.">
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <div key={u.t} className="rounded-2xl border border-vline bg-paper p-6 transition hover:-translate-y-0.5 hover:border-emerald/40 hover:shadow-[0_18px_40px_-24px_rgba(13,110,84,.3)]">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald/10 text-emerald">{u.glyph}</div>
              <h3 className="mt-4 font-serif text-base text-ink">{u.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-inkmut">{u.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Capabilities */}
      <Section eyebrow="The platform" title="Everything you need to run agents in production.">
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-vline bg-vline sm:grid-cols-2 lg:grid-cols-4">
          {CAPS.map(([t, d]) => (
            <div key={t} className="bg-paper p-5">
              <div className="font-serif text-base text-ink">{t}</div>
              <div className="mt-1.5 text-[13px] leading-snug text-inkmut">{d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing teaser */}
      <Section eyebrow="Usage-based pricing" title="Pay for the tokens your agents use.">
        <div className="mt-6 flex flex-col items-start gap-5 rounded-2xl border border-vline bg-sand p-7 md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl text-inkmut">
            A small platform fee plus included tokens — and a per-token rate that <span className="text-ink">drops as you scale</span>,
            from $9/1M down to $3/1M at a billion tokens. Estimate your bill on the pricing page.
          </p>
          <button onClick={() => onNav("pricing")}
            className="shrink-0 rounded-lg border border-emerald px-5 py-3 text-sm font-medium text-emerald transition hover:bg-emerald hover:text-paper">
            View pricing & estimator →
          </button>
        </div>
      </Section>

      {/* CTA */}
      <section className="border-t border-vline bg-ink text-paper">
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl font-semibold leading-tight md:text-[2.6rem]">
            Agents and workflows that <em className="italic" style={{ color: "#5fe0b8" }}>evolve</em> to solve the problems of today — and tomorrow.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            Open the console and ship your first multi-agent payment workflow in minutes.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <button onClick={onSignIn}
              className="rounded-lg bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-px">
              Open the console →
            </button>
            <button onClick={() => onNav("pricing")}
              className="rounded-lg border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:text-white">
              See pricing
            </button>
          </div>
        </div>
      </section>

      <PublicFooter onNav={onNav} onSignIn={onSignIn} />
    </div>
  );
}

function Section({ id, eyebrow, title, intro, children }: {
  id?: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-vline">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">{eyebrow}</div>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink md:text-[2.4rem]">{title}</h2>
          {intro && <p className="mt-3 text-inkmut">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
