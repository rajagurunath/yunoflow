# Build Progress (Ralph loop)

Tracks phase gates from `backend-implementation-plan.md`. Each phase ends green & committed.

| Phase | Status | Gate | Notes |
|---|---|---|---|
| P0 Skeleton | ✅ GREEN | `P0_GREEN` | docker compose up boots; /health ok; 7 tables via Alembic. db host port → **5433** (5432 was taken). mlflow moved to `[obs]` extra. |
| P1 Vertical Slice 🛡️ | ⬜ next | `P1_GREEN` | Agent CRUD + fixed 2-agent LangGraph + Telegram + persisted messages + interrupt/resume |
| P2 Visual Builder + Compiler | ⬜ | `P2_GREEN` | |
| P3 Config + Tools + Templates + Scheduling | ⬜ | `P3_GREEN` | |
| P4 Monitoring + Observability | ⬜ | `P4_GREEN` | langchain-core 1.2.31 is above mlflow autolog range (0.3.25–1.2.15) — verify/pin at P4 |
| P5 Differentiators (A2A + DeepAgents, gated) | ⬜ | `P5_GREEN` | droppable |
| P6 Durability (DBOS, gated) | ⬜ | `P6_GREEN` | droppable |
| P7 Hardening | ⬜ | `P7_GREEN` | |
| P8 Docs & Demo | ⬜ | `P8_GREEN` | |

## Resolved versions (P0)
langgraph 1.1.6 · langgraph-checkpoint-postgres 3.1.0 · langchain-openai 0.3.34 · langchain-core 1.2.31 · aiogram 3.28.2 · fastapi 0.136.3 · sqlalchemy 2.0.49 · alembic 1.18.4 · pydantic 2.13.4

## Conventions
- One-command demo: `make up` (db on host :5433, backend on :8000).
- Native iteration: `make dev`. Tests: `make test`. Each phase commits on green.
