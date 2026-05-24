# Build Progress (Ralph loop)

Tracks phase gates from `backend-implementation-plan.md`. Each phase ends green & committed.

| Phase | Status | Gate | Notes |
|---|---|---|---|
| P0 Skeleton | ✅ GREEN | `P0_GREEN` | docker compose up boots; /health ok; 7 tables via Alembic. db host port → **5433** (5432 was taken). mlflow moved to `[obs]` extra. |
| P1 Vertical Slice 🛡️ | ✅ GREEN | `P1_GREEN` | Agent CRUD; fixed researcher→reviewer→writer LangGraph w/ AsyncPostgresSaver; executor (updates stream + robust interrupt detect via aget_state); Telegram long-poll + router; /api/runs + messages + resume. 3 tests pass; live run completed against real LLM; telegram.started confirmed. NullPool for asyncio safety; tz-aware datetimes fixed. |
| P2 Visual Builder + Compiler | ✅ GREEN | `P2_GREEN` | schemas/graph.py; compiler.py (validate + ReactFlow→StateGraph, conditional edges via path_map on state['route'], native cycles); generic nodes (agent/condition[value\|expr\|llm]/tool); builder.py (compiled vs fixed fallback); Executor refactored graph-agnostic; /api/workflows CRUD + /validate. 10 tests pass; live compiled workflow ran end-to-end. |
| P3 Config + Tools + Templates + Scheduling | ✅ GREEN | `P3_GREEN` | Tool registry (@register) + 8 builtins incl AP2 payment_mock; resolve()+allowed_tools; agent nodes do ReAct (create_react_agent) when tools present; guardrails (recursion_limit + token/cost budget → run 'failed'); APScheduler wiring for schedule_cron; 3 seed templates (idempotent, agent_spec→instantiate); /api/tools, /api/templates (+instantiate). 13 tests pass; live: instantiate+run Triage template E2E. |
| P4 Monitoring + Observability | ⬜ | `P4_GREEN` | langchain-core 1.2.31 is above mlflow autolog range (0.3.25–1.2.15) — verify/pin at P4 |
| P5 Differentiators (A2A + DeepAgents, gated) | ⬜ | `P5_GREEN` | droppable |
| P6 Durability (DBOS, gated) | ⬜ | `P6_GREEN` | droppable |
| P7 Hardening | ⬜ | `P7_GREEN` | |
| P8 Docs & Demo | ⬜ | `P8_GREEN` | |

## Resolved versions (P0)
langgraph 1.1.6 · langgraph-checkpoint-postgres 3.1.0 · langchain-openai 0.3.34 · langchain-core 1.2.31 · aiogram 3.28.2 · fastapi 0.136.3 · sqlalchemy 2.0.49 · alembic 1.18.4 · pydantic 2.13.4

## Polish backlog (do in P8)
- Tune the LLM condition/route prompt + parsing (a clear refund routed to the info branch in a live run). Platform routes correctly per the classifier; the classifier prompt needs sharpening for demo accuracy.

## Conventions
- One-command demo: `make up` (db on host :5433, backend on :8000).
- Native iteration: `make dev`. Tests: `make test`. Each phase commits on green.
