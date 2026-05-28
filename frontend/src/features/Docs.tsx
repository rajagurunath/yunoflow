import { useEffect, useState } from "react";
import { PublicFooter, PublicNav, type PublicPage } from "../components/PublicChrome";

/* A real, self-contained docs page — grounded in what the platform actually does
 * (LangGraph runtime, 14 agent dimensions, channels + human-in-the-loop, cron
 * scheduling, live observability, REST/WebSocket API). Sticky TOC + sections. */

const SECTIONS: { id: string; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "concepts", label: "Core concepts" },
  { id: "dimensions", label: "Agent dimensions" },
  { id: "nodes", label: "Node types" },
  { id: "human", label: "Human-in-the-loop" },
  { id: "channels", label: "Channels (Telegram)" },
  { id: "scheduling", label: "Scheduling" },
  { id: "observability", label: "Observability" },
  { id: "guardrails", label: "Guardrails" },
  { id: "api", label: "API reference" },
  { id: "architecture", label: "Architecture" },
  { id: "deploy", label: "Self-host" },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 font-plex text-[12.5px] leading-relaxed text-paper/90">
      <code>{children}</code>
    </pre>
  );
}

function K({ children }: { children: string }) {
  return <code className="rounded bg-sand px-1.5 py-0.5 font-plex text-[12px] text-emerald">{children}</code>;
}

function H({ id, kicker, children }: { id: string; kicker?: string; children: string }) {
  return (
    <div className="scroll-mt-24" id={id}>
      {kicker && <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">{kicker}</div>}
      <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">{children}</h2>
    </div>
  );
}

const DIMENSIONS = [
  ["Name & role", "Identity the agent presents and its job in the graph."],
  ["System prompt", "The base instruction that frames every call."],
  ["Model", "Any OpenAI-compatible model (defaults to the io.net endpoint)."],
  ["Temperature", "Sampling randomness."],
  ["Top-p", "Nucleus sampling cutoff."],
  ["Tools", "Functions the agent may call (ReAct loop runs them for real)."],
  ["Channels", "Where the agent can be reached (e.g. Telegram)."],
  ["Schedule (cron)", "Run the agent on a recurring cron expression."],
  ["Memory", "Mode + window size + summarization for conversation history."],
  ["Skills", "Named capabilities injected into the prompt."],
  ["Interaction rules", "Hard behavioural rules (\"always confirm the order ID\")."],
  ["Guardrails", "Max steps, max tokens, max cost, allowed tools."],
  ["Personality", "Tone + traits that shape voice."],
  ["Persistence", "Agents are stored and versionable, not ephemeral."],
];

export function Docs({ onNav, onSignIn }: { onNav: (p: PublicPage) => void; onSignIn: () => void }) {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const body = "mt-3 text-[15px] leading-relaxed text-inkmut";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <PublicNav onNav={onNav} onSignIn={onSignIn} current="docs" />

      {/* Header */}
      <section className="vault-glow mx-auto max-w-6xl px-6 pb-8 pt-16">
        <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-emerald">Documentation</div>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.01em] md:text-[3rem]">
          Build, run, and observe multi-agent workflows.
        </h1>
        <p className="mt-4 max-w-2xl text-inkmut">
          YunoFlow turns a visual graph into an executable <span className="text-ink">LangGraph</span> runtime —
          agents call real tools, hand off to each other, pause for human approval, and stream every
          token and cost live. This page is the working reference.
        </p>
      </section>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 pb-24 lg:grid-cols-[210px_1fr]">
        {/* Sticky TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 flex flex-col gap-1.5 border-l border-vline pl-4">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                className={`text-[13px] transition ${active === s.id ? "font-medium text-emerald" : "text-inkmut hover:text-ink"}`}>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 max-w-2xl space-y-14">
          <section>
            <H id="overview" kicker="Start here">What is YunoFlow?</H>
            <p className={body}>
              YunoFlow is a control plane for agentic systems. You define <span className="text-ink">agents</span> with
              fourteen configurable dimensions, wire them into a <span className="text-ink">workflow</span> on a canvas,
              and the platform compiles that canvas into a real graph that executes — with cycles, conditional
              routing, tool calls, human-in-the-loop pauses, durable checkpoints, and live observability.
            </p>
            <p className={body}>
              It is not a mock: runs hit a real OpenAI-compatible model (the io.net endpoint by default),
              persist to Postgres, and stream events over a WebSocket.
            </p>
          </section>

          <section>
            <H id="quickstart" kicker="Zero to a workflow">Quickstart</H>
            <ol className={`${body} list-decimal space-y-2 pl-5`}>
              <li>Enter the console with your email (no password for the demo).</li>
              <li>Open <span className="text-ink">Templates</span> and instantiate one — e.g.
                <span className="text-ink"> Refund Approval (Human-in-the-loop)</span>. This creates the agents and a graph.</li>
              <li>In the <span className="text-ink">Builder</span>, type a message and press <K>▶ Run</K>.</li>
              <li>Watch the <span className="text-ink">Live Activity Log</span> stream node entry, agent messages, tokens and cost.</li>
              <li>When a run pauses at a human node, approve it in the console or over Telegram.</li>
            </ol>
            <p className={body}>Running locally instead:</p>
            <Code>{`cp backend/.env.example .env   # set LLM_* (+ optional TELEGRAM_BOT_TOKEN)
make up                       # db + backend + frontend
# UI  http://localhost:5173
# API http://localhost:8000/docs`}</Code>
          </section>

          <section>
            <H id="concepts" kicker="Mental model">Core concepts</H>
            <ul className={`${body} space-y-2`}>
              <li><span className="text-ink">Agent</span> — a configured LLM persona (see the 14 dimensions below).</li>
              <li><span className="text-ink">Workflow</span> — a ReactFlow graph of nodes + edges, stored as <K>graph_json</K>.</li>
              <li><span className="text-ink">Compiler</span> — turns <K>graph_json</K> into an executable LangGraph <K>StateGraph</K>.</li>
              <li><span className="text-ink">Run</span> — one execution; messages and token/cost usage persist against it.</li>
              <li><span className="text-ink">State</span> — a shared message list (the agent-to-agent channel) plus a free-form scratchpad.</li>
            </ul>
            <p className={body}>
              Agents inside a workflow hand off through shared state — each node appends to the message list,
              so the next agent sees everything written before it.
            </p>
          </section>

          <section>
            <H id="dimensions" kicker="The differentiator">14 agent dimensions</H>
            <p className={body}>
              Every agent is configurable across fourteen dimensions, all editable in <span className="text-ink">Agent Studio</span>:
            </p>
            <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-vline bg-vline sm:grid-cols-2">
              {DIMENSIONS.map(([name, desc], i) => (
                <div key={name} className="bg-paper p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-plex text-[11px] text-inkdim">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-serif text-[15px] text-ink">{name}</span>
                  </div>
                  <div className="mt-1 text-[13px] leading-snug text-inkmut">{desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <H id="nodes" kicker="Building blocks">Node types</H>
            <ul className={`${body} space-y-2`}>
              <li><K>agent</K> — runs an agent (single LLM call, or a ReAct tool loop when it has tools).</li>
              <li><K>condition</K> — routes to one of several labelled branches (LLM, value, or expression).</li>
              <li><K>tool</K> — runs registry tools directly.</li>
              <li><K>human</K> — pauses the run for a human reply (approval / instructions).</li>
              <li><K>deepagent</K> — a planning deep agent that can spawn sub-agents.</li>
              <li><K>start</K> / <K>end</K> — graph entry and exit.</li>
            </ul>
            <p className={body}>
              Edges out of a <K>condition</K> become conditional edges; a back-edge is a real cycle (supported natively).
            </p>
          </section>

          <section>
            <H id="human" kicker="Approvals">Human-in-the-loop</H>
            <p className={body}>
              Drop a <K>human</K> node into any workflow. When the run reaches it, LangGraph checkpoints and
              the run enters <K>waiting_human</K>. The prompt is surfaced three ways: in the live activity log,
              as an inline reply box in the console, and — if a Telegram bot is bound to the workflow —
              pushed to your chat. Replying (e.g. <K>ok</K>) resumes the exact run from the checkpoint, threading
              your message into shared state as a <K>[human]</K> turn so downstream agents see it.
            </p>
          </section>

          <section>
            <H id="channels" kicker="Talk to your agents">Channels (Telegram)</H>
            <p className={body}>
              A shared default bot serves every workflow; you can also connect a dedicated bot per workflow
              from the <span className="text-ink">Channels</span> page (paste a token from <K>@BotFather</K>). Set an
              approvals chat id — or just message the bot once and it's captured automatically — so console- and
              schedule-started runs can ping you for approval. Slack and WhatsApp share the same channel
              abstraction and are on the roadmap.
            </p>
          </section>

          <section>
            <H id="scheduling" kicker="Run on a clock">Scheduling</H>
            <p className={body}>
              Give an agent or a workflow a cron expression (in Studio or the Builder) and it runs on that
              schedule. The cron is persisted in Postgres; on startup the scheduler re-registers every schedule
              from the database, so jobs survive restarts.
            </p>
            <Code>{`0 9 * * *     # every day at 09:00
*/15 * * * *  # every 15 minutes`}</Code>
          </section>

          <section>
            <H id="observability" kicker="See everything">Observability</H>
            <p className={body}>
              Every run streams structured events over a WebSocket — <K>run_started</K>, <K>node_enter</K>,
              <K>agent_message</K>, <K>tool_call</K>, <K>token_usage</K>, <K>interrupt</K>, <K>run_completed</K> —
              which the console renders as a live activity log with running-node highlighting and a tokens/cost HUD.
              Per-run usage and an aggregate impact-metrics summary are persisted. MLflow tracing is available
              behind a feature flag.
            </p>
          </section>

          <section>
            <H id="guardrails" kicker="Stay in bounds">Guardrails</H>
            <p className={body}>
              Each agent carries guardrails the runtime enforces: <K>max_steps</K> (recursion limit),
              <K>max_tokens</K> and <K>max_cost_usd</K> (a run that exceeds its budget is failed mid-flight),
              and an <K>allowed_tools</K> allow-list. Budgets and limits are derived from the agents in a graph.
            </p>
          </section>

          <section>
            <H id="api" kicker="Integrate">API reference</H>
            <p className={body}>Everything in the console is a REST endpoint; full OpenAPI is at <K>/docs</K>.</p>
            <Code>{`POST /api/auth/login            { email }            -> { token, user }
GET  /api/agents                                     list agents
POST /api/agents                <agent>              create (14 dimensions)
PATCH/api/agents/{id}           <partial>            edit
GET  /api/workflows                                  list workflows
POST /api/workflows             { name, graph_json } create
POST /api/templates/{id}/instantiate                 clone a template
POST /api/runs                  { workflow_id, input } start a run
POST /api/runs/{id}/resume      { value }            resume a human pause
GET  /api/metrics/summary                            impact metrics
POST /api/channels              { workflow_id, ... }  connect a bot
WS   /api/ws/runs/{id}                                live run events`}</Code>
          </section>

          <section>
            <H id="architecture" kicker="Under the hood">Architecture</H>
            <ul className={`${body} space-y-2`}>
              <li><span className="text-ink">Runtime</span> — LangGraph <K>StateGraph</K> with conditional edges, cycles, and <K>interrupt()</K>/resume.</li>
              <li><span className="text-ink">Durability</span> — an async Postgres checkpointer persists graph state between pauses.</li>
              <li><span className="text-ink">API</span> — FastAPI, async SQLAlchemy + Alembic, WebSocket event bus.</li>
              <li><span className="text-ink">Channels</span> — aiogram long-polling; a dynamic manager runs one bot per binding.</li>
              <li><span className="text-ink">Scheduling</span> — APScheduler, re-hydrated from the DB at startup.</li>
              <li><span className="text-ink">Frontend</span> — React + Vite + Tailwind + ReactFlow.</li>
            </ul>
          </section>

          <section>
            <H id="deploy" kicker="Run it anywhere">Self-host</H>
            <p className={body}>
              The whole stack ships as Docker Compose — Postgres, the FastAPI backend, and an nginx-served
              frontend that proxies <K>/api</K> to the backend. Point <K>LLM_BASE_URL</K> at any
              OpenAI-compatible endpoint (io.net, OpenAI, OpenRouter, or a local vLLM server).
            </p>
            <Code>{`make up        # build UI + start db, backend, frontend
make down      # stop
make seed      # reload templates
make test      # backend test suite`}</Code>
          </section>

          <div className="rounded-2xl border border-vline bg-sand p-6">
            <div className="font-plex text-[11px] uppercase tracking-[0.2em] text-goldv">Ready?</div>
            <p className="mt-2 text-sm text-inkmut">Open the live console and instantiate a template in under a minute.</p>
            <button onClick={onSignIn}
              className="mt-4 rounded-lg bg-emerald px-5 py-2.5 text-sm font-semibold text-paper transition hover:-translate-y-px">
              Open the console →
            </button>
          </div>
        </main>
      </div>

      <PublicFooter onNav={onNav} onSignIn={onSignIn} />
    </div>
  );
}
