# Build Progress (Ralph loop)

Tracks phase gates from `backend-implementation-plan.md`. Each phase ends green & committed.

| Phase | Status | Gate | Notes |
|---|---|---|---|
| P0 Skeleton | ✅ GREEN | `P0_GREEN` | docker compose up boots; /health ok; 7 tables via Alembic. db host port → **5433** (5432 was taken). mlflow moved to `[obs]` extra. |
| P1 Vertical Slice 🛡️ | ✅ GREEN | `P1_GREEN` | Agent CRUD; fixed researcher→reviewer→writer LangGraph w/ AsyncPostgresSaver; executor (updates stream + robust interrupt detect via aget_state); Telegram long-poll + router; /api/runs + messages + resume. 3 tests pass; live run completed against real LLM; telegram.started confirmed. NullPool for asyncio safety; tz-aware datetimes fixed. |
| P2 Visual Builder + Compiler | ✅ GREEN | `P2_GREEN` | schemas/graph.py; compiler.py (validate + ReactFlow→StateGraph, conditional edges via path_map on state['route'], native cycles); generic nodes (agent/condition[value\|expr\|llm]/tool); builder.py (compiled vs fixed fallback); Executor refactored graph-agnostic; /api/workflows CRUD + /validate. 10 tests pass; live compiled workflow ran end-to-end. |
| P3 Config + Tools + Templates + Scheduling | ✅ GREEN | `P3_GREEN` | Tool registry (@register) + 8 builtins incl AP2 payment_mock; resolve()+allowed_tools; agent nodes do ReAct (create_react_agent) when tools present; guardrails (recursion_limit + token/cost budget → run 'failed'); APScheduler wiring for schedule_cron; 3 seed templates (idempotent, agent_spec→instantiate); /api/tools, /api/templates (+instantiate). 13 tests pass; live: instantiate+run Triage template E2E. |
| P4 Monitoring + Observability | ✅ GREEN | `P4_GREEN` | run_events table (mig 0002); EventBus (persist+seq+pubsub); executor emits run_started/agent_message/token_usage/interrupt/run_completed/error; WebSocket /api/ws/runs/{id} (replay+live); /runs/{id}/events + /usage; MLflow autolog flagged ([obs] extra, FEATURE_MLFLOW, optional compose service). 14 tests pass; live WS + usage verified. FIXED: agent_ids was ignored by create_run (P2 regression). |
| **FRONTEND** (React+ReactFlow per frontend-design.md) | ✅ GREEN | n/a | Vite+React+TS+Tailwind+ReactFlow "Midnight Ledger". Shell+rail; Template Gallery (instantiate); Agent Studio (CRUD + tool picker); Workflow Builder (ReactFlow custom nodes, layered auto-layout, Run) with live WebSocket Monitor (node glow, token/cost HUD, event timeline). Verified live: instantiate→visual graph→Run→real multi-agent LLM→completed, 1154 tok. Served via nginx container (`make up`); node build runs on host (node Docker image fails to exec on this machine). |
| P5 Differentiators (A2A + DeepAgents, gated) | ⬜ | `P5_GREEN` | droppable bonus (after frontend + P7/P8) |
| P6 Durability (DBOS, gated) | ⬜ | `P6_GREEN` | droppable |
| P7 Hardening | ✅ GREEN | `P7_GREEN` | ruff clean; 14 tests pass; /api/channels CRUD + /status (real bot live). FIXED latent bug: LLM condition nodes defaulted to model gpt-4o-mini → 404 on io.net → always took default branch. Now use settings.llm_model + classify on last human turn. Routing verified both branches (refund→refund, info→faq). |
| P8 Docs & Demo | ⬜ | `P8_GREEN` | |

## Resolved versions (P0)
langgraph 1.1.6 · langgraph-checkpoint-postgres 3.1.0 · langchain-openai 0.3.34 · langchain-core 1.2.31 · aiogram 3.28.2 · fastapi 0.136.3 · sqlalchemy 2.0.49 · alembic 1.18.4 · pydantic 2.13.4

## Polish backlog (do in P8)
- Tune the LLM condition/route prompt + parsing (a clear refund routed to the info branch in a live run). Platform routes correctly per the classifier; the classifier prompt needs sharpening for demo accuracy.
- Tests truncate the shared docker DB before each test but leave the last test's rows; a no-agent_ids demo run picks the 2 oldest agents and could grab test leftovers (gpt-4o-mini). Mitigated: explicit agent_ids honored, and templates create their own agents. Consider a separate test DB or teardown truncate.

## Conventions
- One-command demo: `make up` (db on host :5433, backend on :8000).
- Native iteration: `make dev`. Tests: `make test`. Each phase commits on green.
