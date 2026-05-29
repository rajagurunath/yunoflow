import { useState } from "react";
import { PublicFooter, PublicNav, type PublicPage } from "../components/PublicChrome";

/* A creative "horizon" roadmap: four lanes (Now → Exploring) flowing left to
 * right, items tagged by theme and shown with a progress bar. Theme chips at the
 * top filter/highlight across all lanes. Grounded in the real build + the next
 * steps discussed (A2A task execution, sandboxed execution, eval/replay, …). */

type Status = "shipped" | "building" | "planned" | "exploring";
type Theme = "Interop" | "Execution" | "Channels" | "Observability" | "Trust" | "Quality" | "Core";

interface Item { title: string; desc: string; theme: Theme; progress: number; star?: boolean }

const HORIZONS: { key: Status; label: string; sub: string; accent: string; glyph: string; items: Item[] }[] = [
  {
    key: "shipped", label: "Now — shipped", sub: "Live in the product today", accent: "#0d6e54", glyph: "✓",
    items: [
      { title: "Visual builder → real runtime", desc: "The ReactFlow canvas compiles 1:1 to an executable LangGraph StateGraph.", theme: "Core", progress: 100 },
      { title: "Human-in-the-loop", desc: "A human node pauses runs; approve from the console or Telegram, resume from the checkpoint.", theme: "Execution", progress: 100 },
      { title: "14-dimension agents", desc: "Identity, sampling, tools, memory, guardrails, personality — all editable in Studio.", theme: "Core", progress: 100 },
      { title: "Live observability", desc: "Every message, tool call, token and dollar streamed over WebSocket with node highlighting.", theme: "Observability", progress: 100 },
      { title: "Cron scheduling", desc: "Agents and workflows run on a schedule; persisted in Postgres, re-hydrated on boot.", theme: "Execution", progress: 100 },
      { title: "A2A agent-card discovery", desc: "Agents are A2A-addressable via /api/a2a — the handshake for cross-org calls.", theme: "Interop", progress: 100 },
      { title: "NL / voice → workflow", desc: "Describe (or speak) a workflow and an LLM designs the agents and the graph.", theme: "Core", progress: 100 },
      { title: "Managed DB + HTTPS deploy", desc: "Runs on Supabase Postgres; frontend on Vercel, backend containerized behind TLS.", theme: "Trust", progress: 100 },
    ],
  },
  {
    key: "building", label: "Next — building", sub: "Actively in progress", accent: "#1486a8", glyph: "▸",
    items: [
      { title: "A2A task execution", desc: "Call a remote agent as a workflow node — discover its skills from its card, hand off a task, stream the result back. Agent↔agent and workflow↔workflow, on demand.", theme: "Interop", progress: 35, star: true },
      { title: "Sandboxed execution", desc: "Run tool-calling and whole agents in an isolated sandbox (network/fs scoped, resource-capped) so untrusted tools and code execute safely.", theme: "Execution", progress: 25, star: true },
      { title: "Memory & skills wired through", desc: "Apply memory window/summarisation and inject skills + interaction rules into every agent call.", theme: "Core", progress: 50 },
      { title: "Second channel: Slack / WhatsApp", desc: "Prove the channel abstraction beyond Telegram — same binding, same HITL.", theme: "Channels", progress: 20 },
    ],
  },
  {
    key: "planned", label: "Later — planned", sub: "Designed, scheduled next", accent: "#b78a2e", glyph: "◆",
    items: [
      { title: "Evaluation & replay", desc: "Re-run a past run deterministically and diff outputs — regression-test your agents.", theme: "Quality", progress: 0 },
      { title: "Durable execution (DBOS)", desc: "Postgres-native durable workflows + a durable scheduler jobstore that survives crashes.", theme: "Execution", progress: 0 },
      { title: "MLflow deep tracing on", desc: "Full trace capture (LLM/tool spans) wired into a tracing UI, on by default.", theme: "Observability", progress: 0 },
      { title: "Real auth + rate limiting", desc: "RBAC, API keys and per-key budgets so a public deployment is safe to leave open.", theme: "Trust", progress: 0 },
      { title: "MCP tools", desc: "Expose the tool registry over MCP and consume external MCP servers as agent tools.", theme: "Interop", progress: 0 },
    ],
  },
  {
    key: "exploring", label: "Exploring — research", sub: "Ideas we're pressure-testing", accent: "#7c5cbf", glyph: "✶",
    items: [
      { title: "Fine-tuning loop", desc: "Close the lifecycle — turn real interaction data into prompt/model improvements automatically.", theme: "Quality", progress: 0 },
      { title: "Multi-tenant workspaces", desc: "Isolated orgs, members and per-workspace secrets and quotas.", theme: "Trust", progress: 0 },
      { title: "Agent marketplace", desc: "Shareable, versioned agents and templates installable in one click.", theme: "Core", progress: 0 },
      { title: "Cost-aware routing", desc: "Auto-select the cheapest model that clears a quality bar per step.", theme: "Observability", progress: 0 },
    ],
  },
];

const THEMES: Theme[] = ["Interop", "Execution", "Channels", "Observability", "Trust", "Quality", "Core"];
const THEME_COLOR: Record<Theme, string> = {
  Interop: "#1486a8", Execution: "#0d6e54", Channels: "#b78a2e",
  Observability: "#7c5cbf", Trust: "#c2554d", Quality: "#2c8a6d", Core: "#5a5f66",
};

// A workflow-style DAG: existing state (Today) → milestone stages → North Star
// (desired state), with animated flow along the spine. Pure SVG so it scales.
function RoadmapGraph() {
  const spineY = 120;
  const chipW = 170, chipH = 22, chipY0 = 172, chipStep = 28, nodeW = 134, nodeH = 44;
  const stages = [
    { x: 122, label: "Today", sub: "Existing state", color: "#0d6e54",
      chips: ["Builder → real runtime", "Human-in-the-loop", "Live observability", "Cron scheduling"] },
    { x: 342, label: "Next", sub: "Building", color: "#1486a8",
      chips: ["A2A task execution", "Sandboxed execution", "Memory & skills"] },
    { x: 562, label: "Later", sub: "Planned", color: "#b78a2e",
      chips: ["Eval & replay", "Durable (DBOS)", "Real auth + limits"] },
    { x: 782, label: "Exploring", sub: "Research", color: "#7c5cbf",
      chips: ["Fine-tuning loop", "Multi-tenant", "Marketplace"] },
  ];
  const north = { x: 968, chips: ["Agents that self-improve", "Open interop · A2A + MCP", "Safe · multi-tenant · durable"] };

  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 1080 300" className="w-full min-w-[840px]" role="img"
        aria-label="Roadmap graph from today's existing state to the desired north-star state">
        <defs>
          <linearGradient id="rm-spine" x1="0" x2="1">
            <stop offset="0" stopColor="#0d6e54" /><stop offset=".42" stopColor="#1486a8" />
            <stop offset=".74" stopColor="#7c5cbf" /><stop offset="1" stopColor="#12876a" />
          </linearGradient>
          <linearGradient id="rm-north" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#17a37a" /><stop offset="1" stopColor="#0b6147" />
          </linearGradient>
          <path id="rm-path" d={`M${stages[0].x},${spineY} L${north.x},${spineY}`} fill="none" />
        </defs>

        <line x1={stages[0].x} y1={spineY} x2={north.x} y2={spineY} stroke="url(#rm-spine)" strokeWidth="3" opacity="0.55" />
        {[0, 1.35, 2.7].map((b, i) => (
          <circle key={i} r="3.6" fill="#12876a">
            <animateMotion dur="4.2s" begin={`${b}s`} repeatCount="indefinite"><mpath href="#rm-path" /></animateMotion>
          </circle>
        ))}

        <text x={stages[0].x} y={spineY - 46} textAnchor="middle" className="font-plex" fontSize="9.5" letterSpacing="2" fill="#9aa0a6">EXISTING STATE</text>
        <text x={north.x} y={spineY - 50} textAnchor="middle" className="font-plex" fontSize="9.5" letterSpacing="2" fill="#0d6e54">DESIRED STATE</text>

        {stages.map((s) => (
          <g key={s.label}>
            <line x1={s.x} y1={spineY + nodeH / 2} x2={s.x} y2={chipY0 - 6} stroke={s.color} strokeWidth="1" opacity="0.3" />
            <rect x={s.x - nodeW / 2} y={spineY - nodeH / 2} width={nodeW} height={nodeH} rx="10" fill="#ffffff" stroke={s.color} strokeWidth="1.5" />
            <circle cx={s.x - nodeW / 2 + 15} cy={spineY} r="4" fill={s.color} />
            <text x={s.x - nodeW / 2 + 27} y={spineY - 2} className="font-serif" fontSize="14" fill="#14181c">{s.label}</text>
            <text x={s.x - nodeW / 2 + 27} y={spineY + 12} className="font-plex" fontSize="8" letterSpacing="0.5" fill="#9aa0a6">{s.sub.toUpperCase()}</text>
            {s.chips.map((c, ci) => (
              <g key={c}>
                <rect x={s.x - chipW / 2} y={chipY0 + ci * chipStep} width={chipW} height={chipH} rx="6" fill={`${s.color}12`} stroke={`${s.color}33`} strokeWidth="1" />
                <text x={s.x} y={chipY0 + ci * chipStep + 15} textAnchor="middle" className="font-plex" fontSize="10.5" fill="#3a3f45">{c}</text>
              </g>
            ))}
          </g>
        ))}

        <g>
          <rect x={north.x - 68} y={spineY - 33} width={136} height={66} rx="14" fill="url(#rm-north)" />
          <text x={north.x} y={spineY - 5} textAnchor="middle" className="font-serif" fontSize="15" fill="#ffffff">★ North Star</text>
          <text x={north.x} y={spineY + 13} textAnchor="middle" className="font-plex" fontSize="8" letterSpacing="0.5" fill="#cdeee2">SELF-IMPROVING AGENTS</text>
          {north.chips.map((c, ci) => (
            <g key={c}>
              <rect x={north.x - chipW / 2} y={chipY0 + ci * chipStep} width={chipW} height={chipH} rx="6" fill="#12876a14" stroke="#12876a40" strokeWidth="1" />
              <text x={north.x} y={chipY0 + ci * chipStep + 15} textAnchor="middle" className="font-plex" fontSize="10.5" fill="#0d6e54">{c}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export function Roadmap({ onNav, onSignIn }: { onNav: (p: PublicPage) => void; onSignIn: () => void }) {
  const [active, setActive] = useState<Theme | "All">("All");
  const shown = (it: Item) => active === "All" || it.theme === active;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicNav onNav={onNav} onSignIn={onSignIn} current="roadmap" />

      {/* Header */}
      <section className="vault-glow mx-auto max-w-6xl px-6 pb-8 pt-16">
        <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">Roadmap</div>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.01em] md:text-[3rem]">
          Where YunoFlow is headed.
        </h1>
        <p className="mt-4 max-w-2xl text-inkmut">
          What's live, what's next, and what we're exploring — across four horizons. The near-term
          focus: <span className="text-ink">agent-to-agent task execution</span> and
          <span className="text-ink"> sandboxed tool &amp; agent execution</span>.
        </p>

        {/* Theme filter */}
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <button onClick={() => setActive("All")}
            className={`rounded-full border px-3 py-1 font-plex text-[11px] uppercase tracking-wide transition ${
              active === "All" ? "border-ink bg-ink text-paper" : "border-vline2 text-inkmut hover:text-ink"}`}>
            All
          </button>
          {THEMES.map((t) => (
            <button key={t} onClick={() => setActive(t)}
              className={`rounded-full border px-3 py-1 font-plex text-[11px] uppercase tracking-wide transition ${
                active === t ? "text-paper" : "text-inkmut hover:text-ink border-vline2"}`}
              style={active === t ? { background: THEME_COLOR[t], borderColor: THEME_COLOR[t] } : {}}>
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Evolution-path graph: existing state → desired state */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="rounded-2xl border border-vline bg-paper p-5 md:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">Evolution path</div>
              <h2 className="mt-1 font-serif text-xl font-semibold text-ink">From today's runtime to a self-improving platform.</h2>
            </div>
            <span className="hidden font-plex text-[10px] text-inkdim sm:block">data flows left → right</span>
          </div>
          <div className="mt-5"><RoadmapGraph /></div>
        </div>
      </section>

      {/* Horizon lanes */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        {/* flight-path connector */}
        <div className="relative mb-4 hidden h-px bg-gradient-to-r from-emerald via-[#1486a8] to-[#7c5cbf] md:block" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {HORIZONS.map((h) => {
            const visible = h.items.filter(shown);
            return (
              <div key={h.key} className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg text-sm text-paper" style={{ background: h.accent }}>{h.glyph}</span>
                  <div>
                    <div className="font-serif text-[15px] leading-tight text-ink">{h.label}</div>
                    <div className="font-plex text-[10px] uppercase tracking-wide text-inkdim">{h.sub}</div>
                  </div>
                  <span className="ml-auto font-plex text-[11px] text-inkmut">{visible.length}</span>
                </div>
                <div className="mt-2 h-1 rounded-full" style={{ background: `${h.accent}22` }}>
                  <div className="h-1 rounded-full" style={{ width: h.key === "shipped" ? "100%" : h.key === "building" ? "35%" : h.key === "planned" ? "8%" : "2%", background: h.accent }} />
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  {visible.map((it) => (
                    <article key={it.title}
                      className="group rounded-xl border border-vline bg-paper p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-24px_rgba(20,24,28,.35)]">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md px-1.5 py-0.5 font-plex text-[9px] uppercase tracking-wide text-paper"
                          style={{ background: THEME_COLOR[it.theme] }}>{it.theme}</span>
                        {it.star && (
                          <span className="rounded-md border border-emerald/50 px-1.5 py-0.5 font-plex text-[9px] uppercase tracking-wide text-emerald">★ priority</span>
                        )}
                      </div>
                      <h3 className="mt-2 font-serif text-[15px] leading-snug text-ink">{it.title}</h3>
                      <p className="mt-1 text-[13px] leading-snug text-inkmut">{it.desc}</p>
                      {it.progress > 0 && it.progress < 100 && (
                        <div className="mt-3">
                          <div className="h-1 rounded-full bg-vline">
                            <div className="h-1 rounded-full" style={{ width: `${it.progress}%`, background: h.accent }} />
                          </div>
                          <div className="mt-1 font-plex text-[9px] text-inkdim">{it.progress}% underway</div>
                        </div>
                      )}
                    </article>
                  ))}
                  {visible.length === 0 && (
                    <div className="rounded-xl border border-dashed border-vline2 p-4 text-center text-[12px] text-inkdim">
                      nothing in this theme yet
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-vline bg-sand p-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">Try what's live</div>
            <p className="mt-2 max-w-xl text-inkmut">
              Everything in the <span className="text-ink">Now</span> lane is running in the live console — open it and
              build a multi-agent workflow with a human approval step in under a minute.
            </p>
          </div>
          <button onClick={onSignIn}
            className="shrink-0 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:-translate-y-px hover:bg-ink2">
            Open the console →
          </button>
        </div>
      </section>

      <PublicFooter onNav={onNav} onSignIn={onSignIn} />
    </div>
  );
}
