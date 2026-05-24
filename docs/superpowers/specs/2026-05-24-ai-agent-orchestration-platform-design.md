# Design — AI Agent Orchestration Platform (Yuno Challenge)

**Date:** 2026-05-24
**Author:** Gurunath
**Status:** Approved design → ready for implementation plan
**Submission deadline:** 2026-05-31

## 1. Goal & success definition

Build a platform where users **create AI agents**, **configure** their behavior (personality, tools, schedules, memory, limits, guardrails), and **connect them into collaborative workflows** that run on a **real LangGraph runtime**, execute **real tools**, and **communicate asynchronously**. At least one agent is reachable via **Telegram** for live human conversation. Everything is managed through a **web UI** with a **visual workflow builder** and **live monitoring**.

Success = maximize the challenge's weighted rubric:

| Weight | Criterion | Primary design lever |
|---|---|---|
| **40%** | Working end-to-end demo | Vertical slice green early; 2+ agents + Telegram conversation; one-command run |
| **30%** | Architecture & code quality | Clean UI / runtime / persistence separation; the Compiler; tests on critical paths |
| **20%** | UI/UX & configurability | ReactFlow builder; ~14 agent config dimensions; live monitoring dashboard |
| **10%** | Documentation | README + mermaid architecture diagram + runtime justification + demo gif |

Impact metrics to optimize: # configurable dimensions per agent · time-zero-to-working-workflow · task completion rate · agent-to-agent message reliability.

## 2. Stack decisions (locked)

| Concern | Choice | Rationale |
|---|---|---|
| Agent runtime | **LangGraph** | See `framework.md`. ReactFlow graph maps 1:1 to `StateGraph`; conditions/loops, persistence, streaming, HITL are built-in. Matches Yuno JD. |
| Backend | **FastAPI** + SQLAlchemy(async) + Alembic + Pydantic v2 | Async-first, clean router separation, typed. |
| LLM access | **OpenAI-compatible**, configurable via `langchain-openai` | `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL` env. Swap io.net Intelligence / OpenAI / OpenRouter / local. No lock-in for evaluators. |
| Messaging channel | **Telegram** via **aiogram** (long-polling) | No public webhook → true local-first. Behind a `Channel` ABC for Slack/WhatsApp extension. |
| Frontend | **React + TypeScript + Vite + ReactFlow + Tailwind + shadcn/ui + TanStack Query** | ReactFlow is the visual-builder core; shadcn for polished config-heavy forms (UX 20%). |
| Persistence | **Postgres** (docker-compose) + LangGraph **PostgresSaver** | Production-credible, clean async; SQLite documented as no-docker fallback. |
| Inter-agent protocol | **A2A** (Agent2Agent) at the boundary | Agents are A2A-addressable + a "remote A2A agent" node. Intra-graph comms stay LangGraph state for demo reliability. Ecosystem-literacy signal. |
| Durable exec + scheduling | **APScheduler** (baseline) + **DBOS** (upgrade) | APScheduler covers `schedule_cron`; LangGraph checkpointer covers per-run resume; DBOS adds durable workflows/queues as a Postgres-native library (no new server). |
| Deep observability | **MLflow Tracing** (`langchain.autolog()`) | Local mlflow server; traces conversations/tool-calls/tokens. Complements the required in-UI WebSocket monitor (which is built regardless). |
| Advanced agent | **DeepAgents** (one node/template) | LangGraph-native planning + sub-agents + virtual FS. Bounded to one node so it can't destabilize core. |
| Payments flavor | **AP2-style** mock payment tool + template | Mandate (intent/cart/payment) framing against a mock processor. Direct Yuno nod, no real rails. |
| Run command | `docker compose up` (demo) / `make dev` (fast native iteration) | "Single setup command, fully local." |
| Tests | pytest (backend critical paths) + light Vitest | Named critical paths: agent creation, workflow execution, message delivery. |

Out of scope (YAGNI), documented as README **"future directions"** rather than built: cloud deployment, multi-tenant auth, billing, **AG-UI** (custom WebSocket monitor covers it), **MCP** tool exposure (registry covers it), **Temporal/Hatchet** (need a separate server — DBOS chosen instead), **full AP2 rails** (mock only), and a second agent framework (AutoGen flourish remains an optional appendix — **not required** by the PDF).

### Protocol map (README artifact)

| Edge | Standard | Role here |
|---|---|---|
| Agent ↔ Agent | **A2A** + LangGraph state | A2A at the boundary (addressable agents + remote-agent node); shared state intra-graph. |
| Agent ↔ Human (chat) | **Telegram** | Required conversational channel. |
| Agent ↔ UI (events) | Custom WebSocket *(AG-UI = future)* | Drives live monitoring; AG-UI cited as the standard we'd adopt. |
| Agent ↔ Tools | Internal registry *(MCP = future)* | Real tool execution; MCP cited as the standard. |
| Agent ↔ Payments | **AP2** (mock) | Mandate-framed mock processor in the payments template. |

## 3. Architecture

Three layers with explicit boundaries (the 30% "clear separation" requirement):

```
FRONTEND (React/TS/Vite)
  Agent Studio (CRUD+config) · ReactFlow Workflow Builder · Live Monitor (WS)
  · Message History · Template Gallery
        │ REST + WebSocket
BACKEND (FastAPI)
  Routers (agents, workflows, runs, templates, channels, ws)
  · Graph Compiler: ReactFlow JSON → LangGraph StateGraph
  · Runtime service: executes via astream_events (async), emits events
  · Tool registry (real tools) · LLM client (OpenAI-compatible)
  · Channel layer: Telegram adapter (long-poll) behind Channel ABC
  · Event bus → persists events + fans out to WebSocket
        │
PERSISTENCE (Postgres)
  agents · workflows · workflow_runs · messages · channel_bindings · templates · usage
  + LangGraph PostgresSaver (graph state, memory, interrupt/resume checkpoints)
```

**Module layout**

```
backend/app/
  api/          routers (agents, workflows, runs, templates, channels, ws)
  core/         config, db session, logging, llm client
  models/       SQLAlchemy models
  schemas/      Pydantic schemas
  runtime/      compiler.py (ReactFlow→StateGraph), executor.py, state.py, events.py
  runtime/nodes/  agent_node.py, tool_node.py, condition_node.py, deepagent_node.py, a2a_remote_node.py
  tools/        registry.py + tool implementations (incl. payment_mock.py — AP2-style)
  channels/     base.py (Channel ABC), telegram.py, router.py
  protocols/    a2a/ (server: expose agents as A2A; client: call remote A2A agents)
  scheduling/   scheduler.py (APScheduler) + dbos_workflows.py (durable, optional)
  observability/  mlflow_tracing.py (autolog setup) + event persistence
  templates/    seed workflow definitions
  tests/
frontend/src/
  components/ (agent forms, node types, monitor panels)
  features/   agents/ workflows/ monitor/ templates/
  lib/        api client, ws client, types
  pages/
```

**Key boundary contract — the Compiler:** input is `graph_json` (ReactFlow `{nodes, edges}`); output is a compiled `StateGraph`. Node types: `agent`, `tool`, `condition` (router), `start`, `end`. Edges: plain → `add_edge`; conditional (carry a predicate/label) → `add_conditional_edges`; back-edge → cycle. The Compiler is pure and unit-testable in isolation (no DB, no network) — this is the architectural centerpiece.

## 4. Data model

- **agents** — `id, name, role, system_prompt, model, temperature, top_p, tools[], channels[], schedule_cron, memory{mode:none|window|persistent, window_size, summarize:bool}, skills[], interaction_rules(text), guardrails{max_steps, max_tokens, max_cost_usd, allowed_tools[]}, personality{tone, traits[]}, created_at, updated_at` → **~14 configurable dimensions**.
- **workflows** — `id, name, description, graph_json, created_at, updated_at`
- **workflow_runs** — `id, workflow_id, status(pending|running|waiting_human|completed|failed), started_at, ended_at, total_tokens, total_cost_usd, error`
- **messages** — `id, run_id, sender_agent_id, recipient_agent_id|null, role(system|user|assistant|tool), content, tokens, cost_usd, channel(internal|telegram), external_chat_id|null, created_at`
- **channel_bindings** — `id, agent_id, channel_type, config_json, external_chat_id, active`
- **templates** — `id, name, description, graph_json, seed:bool`
- LangGraph checkpoints live in their own PostgresSaver tables (`thread_id` = `run_id`).

`messages` deliberately doubles as both the **history view** and the **inter-agent monitoring** feed.

## 5. Execution & async agent-to-agent flow

1. User saves a graph → `workflows.graph_json`.
2. `POST /runs` → Compiler builds `StateGraph` (thread_id = run_id, PostgresSaver).
3. Executor runs `astream_events`; for each event (node enter/exit, agent message, tool call/result, token usage) it: (a) persists to `messages`/`usage`, (b) publishes to the in-process **event bus** → WebSocket subscribers.
4. Agents communicate **asynchronously via shared graph state**; conditional edges branch; back-edges form feedback loops.
5. On `interrupt()` (e.g., agent needs info), run → `waiting_human`; an inbound **Telegram** message resumes the checkpoint with the user's reply. **← headline demo moment.**

## 6. Telegram channel

aiogram long-polling, started as a managed background task on backend startup (own module, clean shutdown). Inbound: message → `channels/router.py` resolves the bound agent/workflow → starts or resumes a run → response streamed back to the chat. Outbound replies + inbound prompts persisted to `messages` with `channel='telegram'`. `Channel` ABC defines `start()/stop()/send(chat_id, text)` + an inbound callback so Slack/WhatsApp adapters are drop-in. Documented in README.

## 7. Tool registry (real tools)

A decorated registry exposing real, side-effecting tools: `http_get`, `web_search` (or DuckDuckGo), `calculator`, `current_datetime`, `read_kb` (local markdown KB for the support template). Each agent's `allowed_tools` guardrail filters what the runtime binds. Adding a tool = one decorated function (documented).

## 8. UI/UX

- **Agent Studio** — list + create/edit form exposing all ~14 dimensions (grouped accordions: Identity, Model, Tools, Memory, Schedule, Guardrails, Personality).
- **Workflow Builder** — ReactFlow canvas; drag agent/tool/condition nodes; draw edges; conditional edges get a label/predicate; Save + Run; node status colors update live during a run.
- **Live Monitor** — WebSocket-driven timeline: structured logs, inter-agent messages, per-step + cumulative token/cost. Run selector.
- **Message History** — per-run and per-channel conversation transcripts.
- **Template Gallery** — one-click instantiate the 2 prebuilt workflows.

## 9. Workflow templates (≥2 required; we ship 3, payments-flavored)

1. **Payments Support Triage** — `Triage → condition(refund | info) → {Refund Specialist | FAQ Agent} → Escalation`; feedback loop requests a missing order ID from the Telegram user and resumes. Demonstrates conditions + HITL + channel.
2. **Research → Draft → Review** — `Researcher → Writer → Critic`, cycle back to Writer until Critic approves. Demonstrates loops cleanly.
3. **Payment Authorization (AP2-style)** — `Intake → Risk-Check agent → condition(approve | step-up | decline) → Payment agent (mock processor, AP2 intent/cart/payment mandate framing) → Receipt`; step-up branch asks the Telegram user to confirm. Direct Yuno-domain showcase.

The **DeepAgents** node is used inside an optional **"Dispute Investigator"** agent (planning + sub-agents + virtual FS) that can be dropped into template 1 or 3 to demonstrate long-horizon multi-agent reasoning.

## 10. Testing

- **pytest critical paths:** (a) agent creation API persists + round-trips all dimensions; (b) workflow execution: compile + run a 2-node graph to `completed`, assert messages persisted; (c) message delivery: simulated inbound channel message → agent → outbound, persisted. Compiler gets focused unit tests (conditions, loops, validation errors).
- **Vitest (light):** workflow builder renders nodes/edges; agent form validation.
- LLM calls mocked in tests via a fake OpenAI-compatible client for determinism.

## 11. Run & setup

`docker compose up` → Postgres + backend (uvicorn + Telegram poller) + frontend. `make dev` for native iteration (Postgres in docker, app native). `make seed` loads templates. `.env.example`: `LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, TELEGRAM_BOT_TOKEN, DATABASE_URL`. README documents getting a BotFather token.

## 12. Documentation deliverables (10%)

README with: mermaid architecture diagram, setup (one command), **runtime-choice justification** (from `framework.md`), how-to-add-a-template, how-to-add-a-channel, env reference, and an embedded **demo gif** showing the Telegram conversation driving a multi-agent workflow end-to-end.

## 13. Build phasing (Ralph-loop iterations — each ends green & testable)

**Core track (P0–P4 + P7–P8) protects the rubric; the differentiator track (P5–P6) is phase-gated and independently droppable.**

- **P0 Skeleton** — repo scaffold, docker-compose + Makefile, FastAPI app + health, DB schema + Alembic, LLM client, frontend shell. Empty system boots in one command.
- **P1 Vertical Slice 🛡️** — minimal agent CRUD, a fixed 2-agent LangGraph, Telegram long-poll wired to it, messages persisted + shown in a basic list. **End-to-end demoable → 40% locked.**
- **P2 Visual Builder** — ReactFlow canvas + node/edge types + Compiler (conditions + loops) + run-from-UI.
- **P3 Config + Tools + Templates + Scheduling** — all agent dimensions, tool registry (incl. AP2-style mock payment tool), guardrails, memory, **APScheduler** for `schedule_cron`, the 3 templates + seed.
- **P4 Monitoring + Observability** — WebSocket event stream + monitor dashboard (logs, inter-agent msgs, token/cost) + history viewer, plus **MLflow** `langchain.autolog()` deep tracing.
- **P5 Differentiators (gated)** — **A2A**: agents A2A-addressable + a remote-A2A-agent node; **DeepAgents** node + Dispute Investigator agent. Only after P4 is green.
- **P6 Durability upgrade (gated)** — **DBOS** durable workflows/queues over the existing Postgres. Only after P5 is green.
- **P7 Hardening** — tests on critical paths, error handling, Channel ABC polish, `make seed`.
- **P8 Docs & Demo** — README + mermaid diagram + protocol map + extension guides (add template/channel/tool) + runtime justification + recorded demo gif.
- **P9 (optional appendix, not required)** — AutoGen GroupChat sub-team inside one LangGraph node, only if everything above is green.

## 14. Risks & mitigations

- **Demo flakiness from weak models** → default to a strong configurable model; mock in tests; keep templates short-horizon.
- **Telegram setup friction for evaluators** → README BotFather steps + `.env.example`; UI still fully usable without a token (internal runs).
- **Ralph loop drifting** → phase gates with tests; P1 protects the headline score before any depth.
- **Async/checkpointer complexity** → lean on LangGraph PostgresSaver rather than hand-rolling persistence/resume.
- **Differentiator scope creep (A2A/DeepAgents/DBOS/MLflow/AP2)** → all confined to the gated track P5–P6, each behind its own module + feature flag; if the deadline tightens, they drop cleanly to README "future directions" without touching P0–P4.
- **New-dependency churn** → pin versions; the Compiler, Channel ABC, and tool registry are framework-agnostic interfaces so a swap (e.g. DBOS off) is localized.
