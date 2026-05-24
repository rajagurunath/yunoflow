# Backend Implementation Plan — AI Agent Orchestration Platform (Yuno Challenge)

**Status:** Verified against current package APIs (May 2026). **Scope:** Backend only. The API/WS contract in §4 is the integration boundary the frontend builds against independently.

> **How to read the verification notes.** Every API confirmed against live docs/source is stated plainly. Anything that could not be pinned exactly, or that is changing between releases, is marked **⚠️ verify at build time** with a concrete fallback. Treat those as the only places an autonomous loop should expect drift.

---

## 0. Verified API baseline (the facts this plan stands on)

| Package | Pinned | Verified facts used | Confidence |
|---|---|---|---|
| `langgraph` | `==1.2.1` | `StateGraph`, `add_node`, `add_edge`, `add_conditional_edges(source, router, path_map)`, `START`/`END` from `langgraph.graph`; `compile(checkpointer=...)`; `interrupt`, `Command` from `langgraph.types`; resume via `graph.astream(Command(resume=...), config)`; interrupt detected by `__interrupt__` key in `stream_mode="updates"` chunks. | High |
| `langgraph-checkpoint-postgres` | `==3.1.0` | `from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver`; `AsyncPostgresSaver.from_conn_string(DB_URI)` async ctx mgr; `await cp.setup()` once. Manual conns need `autocommit=True, row_factory=dict_row`. | High |
| `langchain-openai` | `>=0.3,<1` ⚠️ verify | `ChatOpenAI(model=, base_url=, api_key=, temperature=, top_p=, stream_usage=True)`; token usage on `.usage_metadata` of `AIMessage`; `stream_usage=True` required to get usage while streaming. | High |
| `langchain-core` | (transitive) | `astream_events` is a `Runnable` method. **⚠️ verify at build time:** in 1.x the deepwiki source says there is no `v1/v2` arg on the LangGraph wrapper; langchain-core historically used `version="v2"`. **Plan primary = `graph.astream(..., stream_mode=["updates","messages","values"])`** which is stable; `astream_events` is the secondary token-level path. | Medium |
| `aiogram` | `==3.27.0` | `Bot(token)`, `Dispatcher()`, `@dp.message()`, `await dp.start_polling(bot)`; one poller per token. | High |
| `mlflow` | `>=3,<4` ⚠️ verify | `mlflow.langchain.autolog(log_traces=True)`; autolog known-compatible with langchain `0.3.25–1.2.15` (pin within range); local `mlflow ui`/server. | Medium |
| `deepagents` | latest ⚠️ verify | `from deepagents import create_deep_agent`; `create_deep_agent(model=, tools=[...], system_prompt=...)` returns a **compiled LangGraph** invocable with `{"messages": ...}`. | Medium |
| `a2a-sdk` | `==1.0.3` ⚠️ verify (API churn) | v1.0 is Protobuf-backed; `A2ACardResolver`, `create_client` (replaced direct `ClientFactory`), server via Starlette routes + `DefaultRequestHandler` + `AgentExecutor`. **Sources disagree on `A2AStarletteApplication` existence** → gate behind feature flag, pin exact version, follow `a2a-samples` at build time. | Low |
| `dbos` | latest ⚠️ verify | `@DBOS.workflow()`, `@DBOS.step()`, `@DBOS.scheduled('* * * * *')` (scheduled fn takes `(scheduled_time, actual_time)`); Postgres-native, no extra server. Feb 2026 added dynamic `DBOS.create_schedule()`. | Medium |
| `APScheduler` | `>=3.10,<4` | `AsyncIOScheduler`, `scheduler.add_job(func, CronTrigger.from_crontab(expr), id=...)`. (v4 API differs — pin v3.) | High |
| `fastapi` / `uvicorn` / `sqlalchemy[asyncio]` / `asyncpg` / `alembic` / `pydantic` v2 / `psycopg[binary]` | current | psycopg3 needed by PostgresSaver; asyncpg for app SQLAlchemy engine. | High |

**Sources:** [langgraph PyPI](https://pypi.org/project/langgraph/) · [langgraph-checkpoint-postgres PyPI](https://pypi.org/project/langgraph-checkpoint-postgres/) · [LangGraph persistence docs](https://docs.langchain.com/oss/python/langgraph/persistence) · [ChatOpenAI integration](https://docs.langchain.com/oss/python/integrations/chat/openai) · [aiogram long-polling](https://docs.aiogram.dev/en/latest/dispatcher/long_polling.html) · [mlflow.langchain autolog](https://mlflow.org/docs/latest/genai/flavors/langchain/autologging/) · [deepagents PyPI](https://pypi.org/project/deepagents/) · [a2a-sdk PyPI](https://pypi.org/project/a2a-sdk/) / [a2a-python](https://github.com/a2aproject/a2a-python) · [dbos PyPI](https://pypi.org/project/dbos/) / [DBOS scheduled workflows](https://docs.dbos.dev/python/tutorials/scheduled-workflows)

---

## 1. Dependency manifest

`backend/pyproject.toml` (PEP 621, managed with `uv`):

```toml
[project]
name = "yuno-orchestrator"
version = "0.1.0"
requires-python = ">=3.11,<3.13"   # 3.11/3.12; avoid 3.13 churn with native deps
dependencies = [
  # --- Web / persistence (P0) ---
  "fastapi>=0.115,<1.0",
  "uvicorn[standard]>=0.30,<1.0",
  "sqlalchemy[asyncio]>=2.0,<3.0",
  "asyncpg>=0.29,<1.0",            # app DB driver (async)
  "alembic>=1.13,<2.0",
  "pydantic>=2.7,<3.0",
  "pydantic-settings>=2.3,<3.0",
  "python-dotenv>=1.0",
  "structlog>=24.1",
  # --- Runtime (P1/P2) ---
  "langgraph==1.2.1",                       # ⚠️ re-confirm latest 1.x at build
  "langgraph-checkpoint-postgres==3.1.0",
  "psycopg[binary,pool]>=3.2",              # required by PostgresSaver
  "langchain-core>=0.3.60,<1.3",            # ⚠️ keep within mlflow autolog range
  "langchain-openai>=0.3,<1.0",             # ⚠️ verify
  # --- Channel (P1) ---
  "aiogram==3.27.0",
  # --- Tools (P3) ---
  "httpx>=0.27",
  "ddgs>=6.0",                              # web_search; ⚠️ verify pkg name (was duckduckgo-search)
  # --- Scheduling (P3) ---
  "apscheduler>=3.10,<4.0",
  # --- Observability (P4) ---
  "mlflow>=3.0,<4.0",                       # ⚠️ verify autolog/langchain compat
]

[project.optional-dependencies]
# Gated differentiators — only installed when the phase is attempted.
a2a   = ["a2a-sdk==1.0.3"]                  # ⚠️ API churn; pin exact
deep  = ["deepagents"]                      # ⚠️ verify version + signature
dbos  = ["dbos"]                            # ⚠️ verify decorators
dev   = ["pytest>=8", "pytest-asyncio>=0.23", "anyio", "httpx", "ruff", "mypy",
         "respx>=0.21",                     # mock httpx tool calls
         "aiosqlite>=0.20"]                 # SQLite no-docker fallback

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Pinning policy for the loop:** the core track (P0–P4) deps are pinned and assumed stable. Each gated extra (`a2a`, `deep`, `dbos`) must run a one-line import smoke test (in its phase's verification command) before any further work — if import fails, the phase drops to README "future directions" without touching core.

---

## 2. Backend module tree (aligned with spec §3)

```
backend/
  pyproject.toml · alembic.ini · Dockerfile · .env.example
  alembic/
    env.py                       # async Alembic env, reads settings.DATABASE_URL
    versions/                    # migrations (one per model-change phase)
  app/
    main.py                      # FastAPI app factory, lifespan (DB, scheduler, channels, mlflow)
    api/
      deps.py                    # get_db session dependency, get_run_service, etc.
      agents.py                  # /agents CRUD
      workflows.py               # /workflows CRUD + validate
      runs.py                    # /runs create/list/get + resume + cancel
      templates.py               # /templates list + instantiate
      channels.py                # /channels bindings CRUD + status
      ws.py                      # /ws/runs/{run_id} monitor WebSocket
      health.py                  # /health, /readyz
    core/
      config.py                  # Settings (pydantic-settings) — all env vars + feature flags
      db.py                      # async engine, sessionmaker, Base
      logging.py                 # structlog config
      llm.py                     # build_chat_model(agent_cfg) -> ChatOpenAI
      pricing.py                 # model -> (in_price, out_price) per-1k; cost compute
      errors.py                  # typed exceptions -> HTTP mapping
    models/
      __init__.py · base.py      # Base, TimestampMixin, UUID pk
      agent.py · workflow.py · workflow_run.py · message.py
      channel_binding.py · template.py · usage.py
    schemas/
      agent.py · workflow.py · run.py · template.py · channel.py
      events.py                  # WS event envelope models (the WS contract)
      graph.py                   # ReactFlow graph_json schema (nodes/edges) — Compiler input
    runtime/
      state.py                   # AgentState TypedDict (shared graph state)
      compiler.py                # ReactFlow JSON -> compiled StateGraph  ★ centerpiece
      executor.py                # run/resume via astream, persist + fan-out events
      events.py                  # in-process EventBus (asyncio pub/sub per run_id)
      checkpointer.py            # AsyncPostgresSaver lifecycle (shared, app-scoped)
      nodes/
        agent_node.py            # LLM node factory from agent config
        tool_node.py             # ToolNode wrapper bound to allowed_tools
        condition_node.py        # router node from predicate spec
        deepagent_node.py        # (P5, gated) wraps create_deep_agent graph as a node
        a2a_remote_node.py       # (P5, gated) calls a remote A2A agent
    tools/
      registry.py                # @tool decorator + REGISTRY + resolve(names, guardrails)
      builtins.py                # http_get, web_search, calculator, current_datetime, read_kb
      payment_mock.py            # AP2-style mock payment tool(s)
      guardrails.py              # max_steps/tokens/cost enforcement helpers
    channels/
      base.py                    # Channel ABC: start/stop/send + inbound callback
      telegram.py                # aiogram long-poll adapter
      router.py                  # inbound msg -> resolve binding -> start/resume run
      manager.py                 # lifecycle: start/stop all active channels
    protocols/
      a2a/ (P5, gated)
        server.py                # expose agents as A2A servers (AgentCard + executor)
        client.py                # call remote A2A agents
        cards.py                 # build AgentCard from an Agent row
    scheduling/
      scheduler.py               # APScheduler AsyncIOScheduler wiring (schedule_cron)
      dbos_workflows.py          # (P6, gated) DBOS durable run wrapper
    observability/
      mlflow_tracing.py          # autolog setup (flagged)
      metrics.py                 # token/cost aggregation helpers
    templates/
      seed.py                    # 3 seed workflow graph_json + seed agents
      kb/                        # markdown KB files for read_kb (support template)
    tests/
      conftest.py                # async client, test DB, FakeChatModel fixture
      fakes.py                   # FakeChatOpenAI (deterministic), fake tools
      test_agents_api.py · test_workflow_exec.py · test_message_delivery.py
      test_compiler.py · test_executor_events.py · test_guardrails.py
      test_channel_router.py
```

---

## 3. Data model (SQLAlchemy 2.0 async + Alembic)

**Conventions:** `Base = DeclarativeBase`; UUID PKs (`server_default=func.gen_random_uuid()` via `pgcrypto`/`uuid-ossp`, or app-side `uuid4`); `TimestampMixin` (`created_at`, `updated_at`). JSON columns use `JSONB` on Postgres (`.with_variant(JSON, "sqlite")` for the fallback). All config-blob columns are `Mapped[dict]` with a Pydantic schema validating shape at the API boundary.

```python
# models/agent.py  — the ~14 configurable dimensions live here
class Agent(Base, TimestampMixin):
    __tablename__ = "agents"
    id: Mapped[uuid.UUID]            = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str]                                                   # 1 identity
    role: Mapped[str]                                                   # 2
    system_prompt: Mapped[str]       = mapped_column(Text)              # 3
    model: Mapped[str]                                                  # 4
    temperature: Mapped[float]       = mapped_column(default=0.7)       # 5
    top_p: Mapped[float]             = mapped_column(default=1.0)       # 6
    tools: Mapped[list]              = mapped_column(JSONB, default=list)         # 7 (tool names)
    channels: Mapped[list]           = mapped_column(JSONB, default=list)         # 8
    schedule_cron: Mapped[str | None]= mapped_column(nullable=True)     # 9
    memory: Mapped[dict]             = mapped_column(JSONB, default=lambda: {"mode":"window","window_size":10,"summarize":False})  # 10
    skills: Mapped[list]             = mapped_column(JSONB, default=list)         # 11
    interaction_rules: Mapped[str]   = mapped_column(Text, default="") # 12
    guardrails: Mapped[dict]         = mapped_column(JSONB, default=lambda: {"max_steps":12,"max_tokens":20000,"max_cost_usd":0.50,"allowed_tools":[]})  # 13
    personality: Mapped[dict]        = mapped_column(JSONB, default=lambda: {"tone":"professional","traits":[]})  # 14
```

```python
# models/workflow.py
class Workflow(Base, TimestampMixin):
    __tablename__ = "workflows"
    id; name: Mapped[str]; description: Mapped[str] = mapped_column(default="")
    graph_json: Mapped[dict] = mapped_column(JSONB)   # ReactFlow {nodes, edges} — Compiler input

# models/workflow_run.py
class WorkflowRun(Base, TimestampMixin):
    __tablename__ = "workflow_runs"
    id; workflow_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflows.id"))
    status: Mapped[str] = mapped_column(default="pending")  # pending|running|waiting_human|completed|failed
    started_at; ended_at: Mapped[datetime | None]
    total_tokens: Mapped[int] = mapped_column(default=0)
    total_cost_usd: Mapped[float] = mapped_column(default=0.0)
    error: Mapped[str | None]
    # thread_id for the PostgresSaver checkpoint == str(run.id)

# models/message.py  — doubles as history view AND inter-agent monitor feed
class Message(Base):
    __tablename__ = "messages"
    id; run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_runs.id"), index=True)
    sender_agent_id: Mapped[uuid.UUID | None]
    recipient_agent_id: Mapped[uuid.UUID | None]
    role: Mapped[str]                # system|user|assistant|tool
    content: Mapped[str] = mapped_column(Text)
    tokens: Mapped[int] = mapped_column(default=0)
    cost_usd: Mapped[float] = mapped_column(default=0.0)
    channel: Mapped[str] = mapped_column(default="internal")   # internal|telegram
    external_chat_id: Mapped[str | None]
    node_id: Mapped[str | None]      # which graph node emitted it (monitor correlation)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), index=True)

# models/channel_binding.py
class ChannelBinding(Base, TimestampMixin):
    id; agent_id | workflow_id: Mapped[uuid.UUID | None]   # bind to entrypoint
    channel_type: Mapped[str]        # "telegram"
    config_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    external_chat_id: Mapped[str | None] = mapped_column(index=True)  # set on first inbound
    active: Mapped[bool] = mapped_column(default=True)

# models/template.py
class Template(Base, TimestampMixin):
    id; name; description; graph_json: Mapped[dict]=mapped_column(JSONB)
    seed: Mapped[bool] = mapped_column(default=True)

# models/usage.py  — per-step token/cost ledger (granular monitor source)
class Usage(Base):
    id; run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_runs.id"), index=True)
    node_id: Mapped[str | None]; model: Mapped[str | None]
    prompt_tokens: Mapped[int]=mapped_column(default=0)
    completion_tokens: Mapped[int]=mapped_column(default=0)
    total_tokens: Mapped[int]=mapped_column(default=0)
    cost_usd: Mapped[float]=mapped_column(default=0.0)
    created_at: Mapped[datetime]=mapped_column(default=func.now())
```

**Migration approach.** Async Alembic (`alembic/env.py` uses `settings.DATABASE_URL`, runs migrations via `connection.run_sync`). One migration per schema-introducing phase: `0001_p0_core` (agents, workflows, runs, messages, channel_bindings, templates, usage), then additive migrations only. **The PostgresSaver tables are created by `await checkpointer.setup()` on startup — not by Alembic** (keep the two table sets separate, as the spec notes). For the SQLite fallback, `JSONB.with_variant(JSON, "sqlite")` and the SQLite checkpointer (`langgraph-checkpoint-sqlite`) keep migrations portable.

---

## 4. API contract (REST + WebSocket) — the frontend integration boundary

Base path `/api`. All bodies Pydantic v2; all IDs UUID strings; errors as `{"detail": "...", "code": "..."}`.

### 4.1 Agents

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/agents` | — | `AgentRead[]` |
| POST | `/agents` | `AgentCreate` | `AgentRead` (201) |
| GET | `/agents/{id}` | — | `AgentRead` |
| PATCH | `/agents/{id}` | `AgentUpdate` (partial) | `AgentRead` |
| DELETE | `/agents/{id}` | — | 204 |

```python
class GuardrailsModel(BaseModel):
    max_steps: int = 12; max_tokens: int = 20000
    max_cost_usd: float = 0.50; allowed_tools: list[str] = []
class MemoryModel(BaseModel):
    mode: Literal["none","window","persistent"] = "window"
    window_size: int = 10; summarize: bool = False
class PersonalityModel(BaseModel):
    tone: str = "professional"; traits: list[str] = []
class AgentCreate(BaseModel):
    name: str; role: str; system_prompt: str
    model: str; temperature: float = 0.7; top_p: float = 1.0
    tools: list[str] = []; channels: list[str] = []
    schedule_cron: str | None = None
    memory: MemoryModel = MemoryModel()
    skills: list[str] = []; interaction_rules: str = ""
    guardrails: GuardrailsModel = GuardrailsModel()
    personality: PersonalityModel = PersonalityModel()
class AgentRead(AgentCreate): id: str; created_at: datetime; updated_at: datetime
```

### 4.2 Workflows

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/workflows` | — | `WorkflowRead[]` |
| POST | `/workflows` | `WorkflowCreate{name, description, graph_json}` | `WorkflowRead` |
| GET | `/workflows/{id}` | — | `WorkflowRead` |
| PATCH | `/workflows/{id}` | partial | `WorkflowRead` |
| DELETE | `/workflows/{id}` | — | 204 |
| POST | `/workflows/{id}/validate` | — | `ValidationResult{ok: bool, errors: [{node_id?, edge_id?, message}]}` |

`/validate` runs the Compiler in **dry-run** mode (no DB/network) and returns structural errors — the builder calls this on Save.

### 4.3 Runs

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/runs` | `RunCreate{workflow_id, input: {message?: str, vars?: dict}, channel?: "internal"}` | `RunRead` (status `running`/`waiting_human`/`completed`) |
| GET | `/runs` | `?workflow_id=&status=` | `RunRead[]` |
| GET | `/runs/{id}` | — | `RunRead` (includes totals) |
| GET | `/runs/{id}/messages` | `?channel=` | `MessageRead[]` |
| GET | `/runs/{id}/usage` | — | `UsageRead[]` + `{total_tokens, total_cost_usd}` |
| POST | `/runs/{id}/resume` | `ResumeRequest{value: str}` | `RunRead` (resumes an interrupted run) |
| POST | `/runs/{id}/cancel` | — | `RunRead{status:"failed", error:"cancelled"}` |

`POST /runs` starts execution as a **background task** and returns immediately with the current status (it may already be `waiting_human` or `completed` for fast graphs). Live progress is observed on the WS. `RunRead` includes `interrupt: {value, node_id} | null` when `status=="waiting_human"`.

### 4.4 Templates

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/templates` | — | `TemplateRead[]` |
| POST | `/templates/{id}/instantiate` | `{name?}` | `WorkflowRead` (clones graph_json + seeds referenced agents) |

### 4.5 Channels

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/channels` | — | `ChannelBindingRead[]` |
| POST | `/channels` | `{channel_type, agent_id?|workflow_id?, config_json}` | `ChannelBindingRead` |
| DELETE | `/channels/{id}` | — | 204 |
| GET | `/channels/status` | — | `{telegram: {running: bool, bot_username?: str}}` |

### 4.6 WebSocket monitor — `/api/ws/runs/{run_id}`

On connect, the server **replays** persisted events for the run (so late subscribers catch up), then streams live events. Optional `?from_seq=N` to resume. All frames are JSON of one envelope:

```python
class WSEvent(BaseModel):
    seq: int                       # monotonic per run; client de-dupes/orders on this
    run_id: str
    ts: datetime
    type: Literal[
      "run_started","run_status",          # status: pending|running|waiting_human|completed|failed
      "node_enter","node_exit",            # node_id, label
      "agent_message",                     # sender, recipient?, role, content, node_id
      "tool_call","tool_result",           # name, args | output, node_id
      "token_usage",                       # node_id, model, prompt/completion/total, cost_usd
      "interrupt",                         # node_id, value (the question for the human)
      "error","run_completed"
    ]
    data: dict                     # type-specific payload (see below)
```

Payload shapes (the frontend's source of truth):

```jsonc
// node_enter / node_exit
{ "node_id": "writer", "label": "Writer", "node_type": "agent" }
// agent_message
{ "node_id":"writer", "sender_agent_id":"...", "recipient_agent_id":null,
  "role":"assistant", "content":"...", "tokens": 142, "cost_usd": 0.0007 }
// tool_call / tool_result
{ "node_id":"researcher", "name":"web_search", "args":{"q":"..."} }
{ "node_id":"researcher", "name":"web_search", "output":"...", "ok": true }
// token_usage
{ "node_id":"writer", "model":"gpt-4o-mini", "prompt_tokens":900,
  "completion_tokens":142, "total_tokens":1042, "cost_usd":0.0013,
  "cumulative_tokens": 3201, "cumulative_cost_usd": 0.004 }
// interrupt
{ "node_id":"triage", "value":"Please provide your order ID." }
// run_status / run_completed / error
{ "status":"waiting_human" }   |   { "status":"completed" }   |   { "message":"..." }
```

Client→server frames are ignored (monitor is read-only); resume happens over REST `/runs/{id}/resume` or via Telegram. This keeps the WS contract trivial for the frontend.

---

## 5. The Compiler (architectural centerpiece)

### 5.1 ReactFlow graph_json schema (`schemas/graph.py`)

```python
NodeType = Literal["start","end","agent","tool","condition","deepagent","a2a_remote"]

class RFNode(BaseModel):
    id: str
    type: NodeType
    data: dict           # type-specific (below)
    position: dict = {}  # {x,y} — UI only, Compiler ignores

class RFEdge(BaseModel):
    id: str
    source: str
    target: str
    data: dict = {}      # conditional edges carry {"when": <label>} matching condition output
    label: str | None = None

class GraphJSON(BaseModel):
    nodes: list[RFNode]
    edges: list[RFEdge]
```

Node `data` by type:
- `start` → `{}` (single entry; maps to `START`).
- `end` → `{}` (maps to `END`; multiple allowed).
- `agent` → `{"agent_id": "<uuid>"}` (resolved to an `Agent` row at compile time).
- `tool` → `{"tools": ["http_get", ...]}` (a ToolNode; usually targeted by an agent that requested a tool — see §6).
- `condition` → `{"mode":"llm"|"expr", "branches":[{"label":"refund","when":"..."},{"label":"info"}], "default":"info", "prompt"?, "expr"?}`.
- `deepagent` → `{"agent_id"}` (P5).
- `a2a_remote` → `{"card_url": "http://..."}` (P5).

**Conditional edge semantics:** an edge is conditional iff its `source` node is a `condition` node. The condition node's router returns a **label**; the Compiler builds a `path_map` `{label -> target_node_id}` from the outgoing edges' `data.when` (falling back to `edge.label`). A **back-edge** is just any edge whose `target` is topologically earlier — LangGraph supports cycles natively, so no special handling beyond cycle-safety validation (§5.4).

### 5.2 Shared State (`runtime/state.py`)

```python
from typing import Annotated, TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]  # conversation accumulator
    route: str | None          # last condition decision (label) — drives path_map
    scratch: dict              # free-form inter-agent shared data (vars, order_id, etc.)
    step: int                  # incremented per node enter (guardrail max_steps)
    run_id: str
```

`messages` uses the `add_messages` reducer so every node appends rather than overwrites — this is the async agent-to-agent channel (spec §5.4). `route` is what conditional edges read.

### 5.3 Compile algorithm (`runtime/compiler.py`)

```python
from langgraph.graph import StateGraph, START, END

def compile_graph(graph: GraphJSON, *, agents: dict[str,Agent],
                  llm_factory, tool_resolver, dry_run: bool=False) -> "CompiledStateGraph | None":
    errors = validate(graph, agents)            # §5.4 — raises CompileError or returns issues
    if dry_run:
        return None  # validate() already populated the ValidationResult
    builder = StateGraph(AgentState)

    cond_nodes = {n.id for n in graph.nodes if n.type == "condition"}
    start_id   = next(n.id for n in graph.nodes if n.type == "start")

    # 1. Register nodes (start/end are virtual — not added)
    for n in graph.nodes:
        if n.type in ("start","end"):
            continue
        elif n.type == "agent":
            builder.add_node(n.id, make_agent_node(agents[n.data["agent_id"]], llm_factory, tool_resolver))
        elif n.type == "tool":
            builder.add_node(n.id, make_tool_node(tool_resolver(n.data["tools"])))
        elif n.type == "condition":
            builder.add_node(n.id, make_condition_node(n.data, llm_factory))   # writes state["route"]
        elif n.type == "deepagent":          # P5, gated
            builder.add_node(n.id, make_deepagent_node(agents[n.data["agent_id"]], llm_factory, tool_resolver))
        elif n.type == "a2a_remote":         # P5, gated
            builder.add_node(n.id, make_a2a_remote_node(n.data["card_url"]))

    # 2. Edges
    edges_by_source: dict[str, list[RFEdge]] = group_by(graph.edges, key=lambda e: e.source)
    for src, out_edges in edges_by_source.items():
        src_node = node_by_id[src]
        # entry edge: start -> X  ==>  START -> X
        if src_node.type == "start":
            for e in out_edges:
                builder.add_edge(START, _resolve(e.target))   # _resolve maps an 'end' target to END
            continue
        if src_node.type == "condition":
            # conditional edges via path_map keyed on state["route"]
            path_map = {(e.data.get("when") or e.label): _resolve(e.target) for e in out_edges}
            builder.add_conditional_edges(src, lambda s: s["route"], path_map)
        else:
            # plain edges (agent/tool/deepagent/a2a). Cycles are allowed.
            for e in out_edges:
                builder.add_edge(src, _resolve(e.target))

    return builder.compile(checkpointer=get_checkpointer())   # AsyncPostgresSaver, app-scoped

def _resolve(target_id): return END if node_by_id[target_id].type == "end" else target_id
```

`make_condition_node` returns a node that sets `state["route"]`:
```python
def make_condition_node(data, llm_factory):
    labels = [b["label"] for b in data["branches"]]
    async def condition(state: AgentState) -> dict:
        if data["mode"] == "expr":
            route = eval_safe(data["expr"], state["scratch"]) or data.get("default", labels[0])
        else:  # llm classifier — constrained to declared labels
            llm = llm_factory(model=data.get("model","gpt-4o-mini"), temperature=0)
            decision = await classify(llm, state["messages"], labels, data.get("prompt"))
            route = decision if decision in labels else data.get("default", labels[0])
        return {"route": route}
    return condition
```

### 5.4 Validation (pure, unit-tested — no DB/network)

`validate()` returns a `ValidationResult` (used by `/validate`) or raises `CompileError`:
1. Exactly one `start` node; ≥1 `end` reachable.
2. Every `agent`/`deepagent` node's `agent_id` exists in `agents`.
3. Every `condition` node has ≥2 branches; each outgoing edge's `when`/`label` matches a declared branch label; a `default` exists or all labels are covered.
4. No dangling edges (source/target must exist).
5. Every non-`start` node reachable from `start`; warn on nodes with no path to any `end`.
6. `tool` nodes reference registered tools (`tool_resolver` known names).
7. Cycle safety: cycles are allowed, but every cycle must contain at least one node that can break it (a condition routing to a non-cycle node) — else flag "potential infinite loop" (soft warning; `max_steps` guardrail is the hard stop at runtime).

This is the function with the densest unit-test coverage (§13).

---

## 6. Executor + event streaming (`runtime/executor.py`)

**Primary streaming path = `graph.astream(..., stream_mode=["updates","messages","values"])`** (stable in LangGraph 1.x per verification). `astream_events` is kept as an optional finer-grained path behind a flag (**⚠️ verify at build time** whether the `version=` arg is needed for langchain-core).

```python
async def run(self, run: WorkflowRun, graph, initial_input: dict, *, resume: str|None=None):
    cfg = {"configurable": {"thread_id": str(run.id)}}
    stream_input = Command(resume=resume) if resume is not None else initial_input
    cumulative = {"tokens": 0, "cost": 0.0}
    await self._set_status(run, "running"); await self._emit(run, "run_started", {})

    try:
        async for mode, chunk in graph.astream(stream_input, cfg, stream_mode=["updates","messages","values"]):
            if mode == "updates":
                for node_id, update in chunk.items():
                    if node_id == "__interrupt__":
                        intr = update[0]
                        await self._set_status(run, "waiting_human")
                        await self._emit(run, "interrupt", {"node_id": self._last_node, "value": intr.value})
                        return  # leave run paused; resume via /runs/{id}/resume or Telegram
                    await self._emit(run, "node_exit", {"node_id": node_id})
                    await self._persist_node_messages(run, node_id, update)   # -> messages + agent_message events
            elif mode == "messages":
                msg_chunk, meta = chunk                 # (AIMessageChunk, metadata{langgraph_node,...})
                node_id = meta.get("langgraph_node")
                usage = getattr(msg_chunk, "usage_metadata", None)
                if usage:                               # token_usage event + Usage row
                    cost = price(meta.get("ls_model_name"), usage)
                    cumulative["tokens"] += usage["total_tokens"]; cumulative["cost"] += cost
                    await self._persist_usage(run, node_id, usage, cost)
                    await self._emit(run, "token_usage", {"node_id":node_id, **usage, "cost_usd":cost,
                        "cumulative_tokens":cumulative["tokens"], "cumulative_cost_usd":cumulative["cost"]})
        await self._finalize(run, "completed", cumulative)
        await self._emit(run, "run_completed", {"status":"completed"})
    except Exception as e:
        await self._finalize(run, "failed", cumulative, error=str(e))
        await self._emit(run, "error", {"message": str(e)})
```

**Token/cost computation (`core/pricing.py`).** `usage_metadata` on `AIMessage`/`AIMessageChunk` (requires `stream_usage=True` on `ChatOpenAI`) gives `{input_tokens, output_tokens, total_tokens}`. A static `MODEL_PRICES = {"gpt-4o-mini": (0.00015, 0.0006), ...}` table (per-1k, configurable via env `LLM_PRICE_IN/OUT` for custom OpenAI-compatible endpoints) computes `cost = in_tok/1000*in_price + out_tok/1000*out_price`. Unknown models → cost `0.0` + a logged warning (tokens still tracked). Per-step rows go to `usage`; `workflow_runs.total_*` updated on finalize.

**Event bus + fan-out (`runtime/events.py`).** In-process `asyncio` pub/sub keyed by `run_id`: `EventBus.publish(run_id, WSEvent)` writes to a persistent `events` store (reuse `messages`/`usage` plus a lightweight per-run seq counter held in memory + DB) and pushes to all subscribed WS queues. `_emit` assigns the monotonic `seq`, persists, and publishes. On WS connect, `ws.py` first replays persisted events (`seq <= now`) then subscribes for live ones — guaranteeing late/reconnecting clients see the full timeline. Single-process design (matches "fully local"); documented as the AG-UI-shaped boundary we'd standardize later.

---

## 7. Channel layer

### 7.1 Channel ABC (`channels/base.py`)

```python
class InboundMessage(BaseModel):
    channel_type: str; external_chat_id: str; text: str; meta: dict = {}

InboundHandler = Callable[[InboundMessage], Awaitable[None]]

class Channel(ABC):
    channel_type: str
    @abstractmethod
    async def start(self, on_inbound: InboundHandler) -> None: ...
    @abstractmethod
    async def stop(self) -> None: ...
    @abstractmethod
    async def send(self, external_chat_id: str, text: str) -> None: ...
    async def status(self) -> dict: return {"running": False}
```

### 7.2 Telegram adapter (`channels/telegram.py`)

aiogram v3 long-polling, owned as a background task started in the FastAPI lifespan:

```python
class TelegramChannel(Channel):
    channel_type = "telegram"
    def __init__(self, token: str):
        self.bot = Bot(token); self.dp = Dispatcher(); self._task = None
    async def start(self, on_inbound):
        @self.dp.message()
        async def _handler(msg: Message):
            await on_inbound(InboundMessage(channel_type="telegram",
                external_chat_id=str(msg.chat.id), text=msg.text or ""))
        self._task = asyncio.create_task(self.dp.start_polling(self.bot, handle_signals=False))
    async def stop(self):
        await self.dp.stop_polling()
        if self._task: self._task.cancel()
        await self.bot.session.close()
    async def send(self, external_chat_id, text):
        await self.bot.send_message(int(external_chat_id), text)
    async def status(self):
        me = await self.bot.get_me(); return {"running": True, "bot_username": me.username}
```

(`handle_signals=False` is required — uvicorn owns the signal handlers.) If `TELEGRAM_BOT_TOKEN` is unset, the channel manager skips Telegram entirely; the UI/internal runs still work (risk mitigation in spec §14).

### 7.3 Inbound routing + interrupt/resume tie-in (`channels/router.py`)

```python
async def handle_inbound(self, m: InboundMessage):
    binding = await self.repo.resolve_binding(m.channel_type, m.external_chat_id)
    # 1) Is there a run for this chat currently waiting_human? -> resume it.
    waiting = await self.repo.find_waiting_run(binding)
    if waiting:
        await self.repo.persist_message(waiting.id, role="user", channel="telegram",
                                        external_chat_id=m.external_chat_id, content=m.text)
        await self.executor.resume(waiting, value=m.text,
                                   on_reply=lambda text: self.channel.send(m.external_chat_id, text))
    else:
        # 2) Start a fresh run of the bound workflow with the message as input.
        run = await self.runs.create(binding.workflow_id, input={"message": m.text}, channel="telegram")
        await self.executor.run(run, ..., on_reply=lambda text: self.channel.send(m.external_chat_id, text))
```

The executor's `on_reply` callback is invoked when (a) the graph hits `interrupt()` → the interrupt `value` is sent to the chat as the question, and (b) on completion → the final assistant message is sent. So the headline demo loop is: graph runs → `interrupt("What's your order ID?")` → router/executor sends that to Telegram → user replies → `handle_inbound` finds the `waiting_human` run → `executor.resume(run, value=reply)` calls `graph.astream(Command(resume=reply), cfg)` → graph continues → final answer sent back. Every inbound/outbound is persisted to `messages` with `channel="telegram"`.

### 7.4 How to add a new channel (README + code)

1. Subclass `Channel` (e.g. `channels/slack.py`), implement `start/stop/send`.
2. Register it in `channels/manager.py`'s factory map keyed by `channel_type`.
3. Add its env config to `Settings`. No changes to router, executor, or models — the binding row's `channel_type` selects the adapter. Documented as a worked example in README.

---

## 8. Tool registry (`tools/`)

### 8.1 Decorator pattern (`tools/registry.py`)

Wrap LangChain's `@tool` so every tool is both LangChain-bindable and self-describing in our registry:

```python
from langchain_core.tools import tool as lc_tool
REGISTRY: dict[str, ToolSpec] = {}

def register(name: str, *, side_effecting: bool=False):
    def deco(fn):
        lc = lc_tool(fn)                       # LangChain StructuredTool (schema from signature/docstring)
        REGISTRY[name] = ToolSpec(name=name, lc_tool=lc, side_effecting=side_effecting, fn=fn)
        return lc
    return deco

def resolve(names: list[str], guardrails: dict) -> list:
    allowed = set(guardrails.get("allowed_tools") or names)   # allowed_tools narrows; empty => all requested
    return [REGISTRY[n].lc_tool for n in names if n in REGISTRY and n in allowed]
```

### 8.2 Real tools (`tools/builtins.py`)

```python
@register("http_get", side_effecting=True)
async def http_get(url: str) -> str: ...            # httpx GET, truncate body, timeout
@register("web_search", side_effecting=True)
async def web_search(query: str, k: int = 5) -> str: ...  # ddgs; ⚠️ verify pkg name at build
@register("calculator")
def calculator(expression: str) -> str: ...         # safe AST eval, no builtins
@register("current_datetime")
def current_datetime(tz: str = "UTC") -> str: ...
@register("read_kb")
def read_kb(query: str) -> str: ...                 # naive search over templates/kb/*.md
```

### 8.3 AP2-style mock payment tool (`tools/payment_mock.py`)

Mandate-framed against an in-memory mock processor (no real rails):

```python
@register("create_payment_intent", side_effecting=True)
def create_payment_intent(amount: float, currency: str, merchant: str, description: str = "") -> dict:
    # AP2 "intent mandate": user authorizes an intent to pay.
    return {"intent_id": _id("intent"), "amount": amount, "currency": currency, "status": "intent_created"}
@register("create_cart_mandate", side_effecting=True)
def create_cart_mandate(intent_id: str, items: list[dict]) -> dict:
    return {"cart_id": _id("cart"), "intent_id": intent_id, "total": sum(i["price"] for i in items), "status":"cart_created"}
@register("execute_payment", side_effecting=True)
def execute_payment(cart_id: str, payment_method: str) -> dict:
    # AP2 "payment mandate": deterministic mock — declines if total > threshold to exercise step-up branch.
    return {"payment_id": _id("pay"), "cart_id": cart_id, "status": "approved"|"declined", "receipt_url": "..."}
```

### 8.4 Guardrail enforcement (`tools/guardrails.py`)

- `allowed_tools`: enforced at bind time by `resolve()` — the agent node never even sees disallowed tools.
- `max_steps`: `AgentState["step"]` incremented on each agent node entry; condition/agent nodes check it and route to `END` (or raise `GuardrailExceeded`) when exceeded. Also pass LangGraph's `config={"recursion_limit": max_steps+buffer}` as a hard backstop.
- `max_tokens` / `max_cost_usd`: the executor accumulates per-run totals from `usage_metadata`; before each LLM call (or after each step) it checks the budget and, if exceeded, finalizes the run as `failed` with `error="budget_exceeded"` and emits an `error` WS event.

### 8.5 How to add a tool (README)

Add one `@register("name")` function in `tools/builtins.py` (or a new module imported by the registry). It auto-appears in the agent config's tool picker (frontend reads `GET /tools` — a small endpoint listing `REGISTRY` names + schemas). No runtime/compiler changes.

---

## 9. A2A integration (P5, gated, bounded) — `protocols/a2a/`

**⚠️ verify at build time:** `a2a-sdk` 1.x is Protobuf-backed and the surface changed (e.g. `A2AStarletteApplication` removed per one source; `create_client` replaced direct `ClientFactory`). Pin `a2a-sdk==1.0.3`, run the import smoke test first, and follow the `a2a-samples` repo for exact symbols. Keep scope to two thin pieces:

1. **Expose agents as A2A servers (`server.py` + `cards.py`).** For each agent flagged `a2a_exposed`, build an `AgentCard` (name, description, version, capabilities, a JSON-RPC interface URL) and an `AgentExecutor` whose `execute()` runs that single agent (a one-node LangGraph) and enqueues the result message. Mount on the same uvicorn app under `/a2a/{agent_id}` (Starlette routes via `create_jsonrpc_routes`/`create_agent_card_routes` + `DefaultRequestHandler`). Started in lifespan only when `FEATURE_A2A=true`.

2. **Remote-A2A-agent node (`a2a_remote_node.py` + `client.py`).** A `a2a_remote` graph node whose `data.card_url` points at any A2A agent (ours or external). The node:
   ```python
   def make_a2a_remote_node(card_url):
       async def node(state):
           async with httpx.AsyncClient() as hc:
               card = await A2ACardResolver(hc, card_url).get_agent_card()
               client = await create_client(card)                  # ⚠️ verify symbol
               text = last_human_text(state["messages"])
               reply = await collect(client.send_message(make_message(text)))
           return {"messages": [AIMessage(content=reply)]}
       return node
   ```

Intra-graph agent comms remain LangGraph state (reliable for the demo); A2A is strictly the boundary protocol. If the SDK import fails, the node type is hidden and the feature is documented as "future direction" — no impact on P0–P4.

---

## 10. DeepAgents node (P5, gated) — `runtime/nodes/deepagent_node.py`

`create_deep_agent(model, tools, system_prompt)` returns a compiled LangGraph graph invocable with `{"messages": [...]}` (verified). Wrap it as a single LangGraph node so it composes inside our StateGraph:

```python
from deepagents import create_deep_agent

def make_deepagent_node(agent: Agent, llm_factory, tool_resolver):
    sub = create_deep_agent(
        model=llm_factory.spec_for(agent),              # ChatOpenAI w/ our base_url (⚠️ verify model arg form)
        tools=tool_resolver(agent.tools, agent.guardrails),
        system_prompt=agent.system_prompt,
    )
    async def node(state: AgentState) -> dict:
        result = await sub.ainvoke({"messages": state["messages"]})
        return {"messages": result["messages"][-1:]}    # append only the final message to shared state
    return node
```

**⚠️ verify at build time:** whether `create_deep_agent` accepts a `ChatModel` instance vs a `"openai:model"` string for a custom `base_url`. Fallback: pass a configured `ChatOpenAI` instance (LangChain models are accepted by most LangGraph-native harnesses); if only string form works, set `OPENAI_BASE_URL`/`OPENAI_API_KEY` env so the string form resolves to our endpoint.

**Usage:** the "Dispute Investigator" agent is a `deepagent` node droppable into Template 1 or 3 (planning + sub-agents + virtual FS for long-horizon dispute reasoning). Its sub-agent token usage is captured because it streams through the same `astream` `messages` mode.

---

## 11. Scheduling + durability

### 11.1 APScheduler (P3, baseline) — `scheduling/scheduler.py`

```python
scheduler = AsyncIOScheduler()  # started in lifespan
def schedule_agent(agent: Agent):
    if not agent.schedule_cron: return
    scheduler.add_job(_trigger_agent_run, CronTrigger.from_crontab(agent.schedule_cron),
                      id=f"agent:{agent.id}", replace_existing=True, args=[agent.id])
async def _trigger_agent_run(agent_id):
    # create a single-agent run (or its bound workflow) on schedule
    ...
```

On agent create/update with a `schedule_cron`, (re)register the job; on delete, `scheduler.remove_job`. Jobs persist across restarts via an APScheduler SQLAlchemy jobstore pointed at the same Postgres (so schedules survive restarts).

### 11.2 DBOS durable upgrade (P6, gated, feature-flagged) — `scheduling/dbos_workflows.py`

Behind `FEATURE_DBOS=true`. DBOS is a Postgres-native **library** (no new server — matches spec). When enabled, wrap run execution in a durable workflow so a crash mid-run resumes exactly-once:

```python
from dbos import DBOS
@DBOS.workflow()
def durable_run(run_id: str, input_json: dict):
    _compile_step(run_id)          # @DBOS.step()
    _execute_step(run_id, input_json)
@DBOS.scheduled('*/5 * * * *')     # optional: durable periodic sweeps (fn takes scheduled_time, actual_time)
@DBOS.workflow()
def sweep_stuck_runs(scheduled_time, actual_time): ...
```

When the flag is off, the executor runs directly (P1–P5 path). DBOS and the LangGraph PostgresSaver coexist on the same Postgres but in separate schemas. **⚠️ verify at build time:** DBOS init (`DBOS(config=...)` + `DBOS.launch()`) ordering with FastAPI lifespan, and that decorators are applied at import time before launch.

---

## 12. Observability — `observability/`

1. **MLflow tracing (P4).** In lifespan, if `FEATURE_MLFLOW=true`: `mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)`, `mlflow.set_experiment("yuno-orchestrator")`, `mlflow.langchain.autolog(log_traces=True)`. Every LangGraph/LLM/tool call is then auto-traced to the local MLflow server (`mlflow ui` / docker service) — conversations, tool calls, latencies, token usage. **⚠️ verify at build time:** keep `langchain`/`langchain-core` within MLflow's autolog-compatible range (`0.3.25–1.2.15` per docs) — this is the main pin risk; if out of range, autolog silently no-ops, so add a startup log asserting a trace is produced.
2. **Custom event persistence (built regardless).** The §6 EventBus persists every event (messages/usage + seq) and drives the WS monitor. This is the rubric-required in-UI live monitoring; MLflow is the deep-trace complement.
3. **Captured metrics/traces:** per-step + cumulative tokens & cost (`usage`), inter-agent messages (`messages`), node enter/exit timeline, tool call/result, interrupts, run status transitions, errors. README cites AG-UI (events) and MCP (tools) as the standards we'd adopt.

---

## 13. Testing (`app/tests/`) — pytest, deterministic

**Fake OpenAI-compatible client (`tests/fakes.py`):** `FakeChatModel(BaseChatModel)` returns scripted `AIMessage`s with synthetic `usage_metadata` (so token/cost paths run deterministically), supports `bind_tools` (emits canned tool calls), and `astream`. Injected by overriding `core.llm.build_chat_model` via dependency override / monkeypatch. Tools that hit the network (`http_get`, `web_search`) are mocked with `respx`.

Critical-path tests (named in the PDF):
- `test_agents_api.py` — **agent creation**: POST all 14 dimensions → 200; GET round-trips every field incl. nested `memory`/`guardrails`/`personality`; PATCH partial update; DELETE.
- `test_workflow_exec.py` — **workflow execution**: compile + run a 2-agent graph with `FakeChatModel` to `completed`; assert ≥2 `messages` persisted with correct `node_id`/`role`, `usage` rows present, `workflow_runs.total_tokens>0`.
- `test_message_delivery.py` — **message delivery**: simulate `InboundMessage` → router starts run → fake agent replies → assert `on_reply` called with final text and inbound+outbound persisted with `channel="telegram"`.

Compiler unit tests (`test_compiler.py`, pure, no DB/network):
- linear 3-node compiles + executes order; conditional 2-branch routes per `state["route"]`; cycle (Critic→Writer) runs and terminates via condition; validation errors: missing start, unknown agent_id, condition branch/edge-label mismatch, dangling edge, unreachable node; `path_map` built correctly from `edge.data.when`.

Plus `test_executor_events.py` (event envelope shapes + seq monotonicity + replay-on-connect), `test_guardrails.py` (max_steps/budget cut a run to `failed`), `test_channel_router.py` (waiting_human run resumes on inbound). Target: green `pytest` is every phase's gate.

---

## 14. Local run

**`docker-compose.yml` services:** `db` (postgres:16, healthcheck), `backend` (uvicorn + Telegram poller, depends_on db healthy, runs `alembic upgrade head` then `make seed` on first boot), `mlflow` (optional, `mlflow server` on 5000, gated by profile), `frontend` (vite preview/nginx). One command: `docker compose up`.

**`Makefile` targets:**
```
make up      # docker compose up --build (full demo)
make dev     # postgres in docker; backend (uvicorn --reload) + frontend native
make migrate # alembic upgrade head
make seed    # python -m app.templates.seed  (load 3 templates + seed agents)
make test    # pytest (backend) ; npm -C frontend test (vitest)
make lint    # ruff + mypy
make down    # compose down -v
```

**`.env.example`:**
```
DATABASE_URL=postgresql+asyncpg://yuno:yuno@db:5432/yuno
CHECKPOINT_DB_URI=postgresql://yuno:yuno@db:5432/yuno   # psycopg form for PostgresSaver
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
LLM_PRICE_IN=0.00015          # per-1k input (custom endpoints)
LLM_PRICE_OUT=0.0006
TELEGRAM_BOT_TOKEN=           # blank = Telegram disabled, UI still works
MLFLOW_TRACKING_URI=http://mlflow:5000
FEATURE_MLFLOW=false
FEATURE_A2A=false
FEATURE_DEEPAGENTS=false
FEATURE_DBOS=false
```

SQLite no-docker fallback: `DATABASE_URL=sqlite+aiosqlite:///./yuno.db` + SQLite checkpointer; documented in README.

---

## 15. Per-phase task breakdown (Ralph-loop gates)

> Each phase: tasks → files → **acceptance criteria** → **verification command** (must pass before advancing). Commands assume the backend on `:8000`, Postgres up.

### P0 — Skeleton
**Tasks:** scaffold repo + `pyproject`; `core/config.py`, `core/db.py`, `core/logging.py`; FastAPI app factory + lifespan (DB connect); `/health`; all 7 models + `0001_p0_core` migration; `core/llm.build_chat_model`; docker-compose (db+backend) + Makefile + `.env.example`.
**Files:** `app/main.py`, `app/core/*`, `app/models/*`, `alembic/*`, `docker-compose.yml`, `Makefile`, `pyproject.toml`.
**Acceptance:** `docker compose up` boots; `/health` 200; `alembic upgrade head` creates all 7 tables; `build_chat_model` returns a `ChatOpenAI` with the env base_url.
**Verify:** `make up && sleep 8 && curl -fsS localhost:8000/health && docker compose exec -T db psql -U yuno -c "\dt" | grep -q agents && echo P0_GREEN`

### P1 — Vertical Slice 🛡️ (locks the 40%)
**Tasks:** minimal Agent CRUD (`api/agents.py`, schemas); a **hard-coded 2-agent LangGraph** (e.g. Researcher→Writer) with `AsyncPostgresSaver`; `executor.run` (basic, `astream` updates+messages); persist `messages`; `POST /runs` + `GET /runs/{id}/messages`; Telegram channel + router wired to start a run and send the reply; `interrupt()`/resume happy path.
**Files:** `api/agents.py`, `api/runs.py`, `runtime/{state,executor,checkpointer}.py`, `channels/{base,telegram,router,manager}.py`, `schemas/{agent,run}.py`.
**Acceptance:** create 2 agents; `POST /runs` runs the fixed graph to `completed`; messages persisted + retrievable; a Telegram message triggers a run and gets a reply; one `interrupt`→reply→resume loop completes.
**Verify:** `pytest app/tests/test_workflow_exec.py app/tests/test_message_delivery.py -q && curl -fsS -XPOST localhost:8000/api/runs -d '{"workflow_id":"<fixed>","input":{"message":"hi"}}' -H 'content-type: application/json' | grep -q '"status"' && echo P1_GREEN`

### P2 — Visual Builder + Compiler
**Tasks:** `schemas/graph.py`; `runtime/compiler.py` (nodes/edges/conditions/cycles) + `validate()`; `runtime/nodes/{agent,tool,condition}_node.py`; Workflow CRUD + `/validate`; `POST /runs` now compiles from `workflows.graph_json`.
**Files:** `runtime/compiler.py`, `runtime/nodes/*`, `api/workflows.py`, `schemas/graph.py`.
**Acceptance:** Compiler turns a `{nodes,edges}` JSON into a runnable graph; conditional + cyclic graphs execute and terminate; `/validate` returns precise errors; all compiler unit tests pass.
**Verify:** `pytest app/tests/test_compiler.py -q && echo P2_GREEN`

### P3 — Config + Tools + Templates + Scheduling
**Tasks:** full 14-dimension agent config end-to-end; `tools/registry.py` + `builtins.py` + `payment_mock.py` + `guardrails.py`; `GET /tools`; agent nodes bind `resolve(tools, guardrails)`; `scheduling/scheduler.py` (APScheduler + jobstore); 3 seed templates + `templates/seed.py` + `/templates` + instantiate.
**Files:** `tools/*`, `scheduling/scheduler.py`, `api/templates.py`, `app/templates/*`.
**Acceptance:** agent round-trips all 14 dims; tools execute (calculator/datetime deterministic; http mocked in tests); `allowed_tools` filters binding; guardrail trips to `failed`; `make seed` loads 3 templates; cron schedule registers a job.
**Verify:** `make seed && pytest app/tests/test_agents_api.py app/tests/test_guardrails.py -q && curl -fsS localhost:8000/api/templates | grep -c '"id"' && echo P3_GREEN`

### P4 — Monitoring + Observability
**Tasks:** `runtime/events.py` EventBus + `_emit` everywhere in executor; `api/ws.py` (replay + live, `seq` envelope); `usage` persistence + cumulative cost; `GET /runs/{id}/usage`; `observability/mlflow_tracing.py` autolog (flagged); optional `mlflow` compose service.
**Files:** `runtime/events.py`, `api/ws.py`, `observability/*`, `core/pricing.py`.
**Acceptance:** WS streams the full event sequence incl. token_usage with cumulative cost; reconnect replays; usage rows persisted; with `FEATURE_MLFLOW=true` traces appear in MLflow UI.
**Verify:** `pytest app/tests/test_executor_events.py -q && python -c "import asyncio,websockets,json" && echo P4_GREEN` (plus a scripted WS client asserting ≥1 `token_usage` frame during a run).

### P5 — Differentiators (gated: A2A + DeepAgents)
**Tasks:** install extras; import smoke test gate; `protocols/a2a/{server,client,cards}.py` + `a2a_remote_node.py` (flag `FEATURE_A2A`); `deepagent_node.py` + Dispute Investigator agent + Compiler node-type wiring (flag `FEATURE_DEEPAGENTS`).
**Files:** `protocols/a2a/*`, `runtime/nodes/{a2a_remote,deepagent}_node.py`.
**Acceptance:** with flags on — an agent exposes a valid AgentCard fetchable over HTTP; an `a2a_remote` node round-trips a message; a `deepagent` node runs inside a workflow and appends a final message. With flags off — core unaffected.
**Verify:** `python -c "import a2a, deepagents; print('ok')" && FEATURE_A2A=true FEATURE_DEEPAGENTS=true pytest app/tests/test_compiler.py -q && echo P5_GREEN` (if imports fail → mark feature "future direction", keep P0–P4 green, advance.)

### P6 — Durability (gated: DBOS)
**Tasks:** `scheduling/dbos_workflows.py`; DBOS init in lifespan (flag `FEATURE_DBOS`); wrap run execution in `@DBOS.workflow()`; optional durable sweep.
**Files:** `scheduling/dbos_workflows.py`, `app/main.py` (lifespan branch).
**Acceptance:** with `FEATURE_DBOS=true`, a run started then process-killed mid-execution resumes on restart; flag off = direct path unchanged.
**Verify:** `python -c "import dbos; print('ok')" && FEATURE_DBOS=true pytest app/tests/test_workflow_exec.py -q && echo P6_GREEN` (import fail → "future direction".)

### P7 — Hardening
**Tasks:** complete critical-path tests; typed error→HTTP mapping; Channel ABC polish + `/channels` CRUD + `/channels/status`; cancel/budget edge cases; `make seed` idempotent; ruff/mypy clean.
**Files:** `api/channels.py`, `core/errors.py`, `app/tests/*`.
**Acceptance:** full `pytest` green; lint/type clean; cancel + budget + guardrail paths covered.
**Verify:** `make lint && make test && echo P7_GREEN`

### P8 — Docs & Demo
**Tasks:** README (mermaid arch diagram, protocol map, one-command setup, runtime justification from `framework.md`, env reference, add-template / add-channel / add-tool guides, demo gif placeholder); verify one-command boot from clean clone.
**Files:** `README.md`, `docs/*`.
**Acceptance:** fresh clone → `cp .env.example .env` → `docker compose up` → working UI + a Telegram-driven multi-agent run; README renders the diagram and documents all extension points.
**Verify:** `test -f README.md && grep -q 'mermaid' README.md && grep -q 'runtime' README.md && make up && sleep 12 && curl -fsS localhost:8000/health && echo P8_GREEN`

---

## Open verification items to resolve at build time (consolidated)

1. **`astream_events` arg** — confirm whether langchain-core still wants `version="v2"`; primary path uses `astream(stream_mode=[...])` which is verified-stable, so this is non-blocking.
2. **`langchain`/`langchain-core` ↔ MLflow autolog range** — keep within `0.3.25–1.2.15`; assert a trace is produced at startup.
3. **`a2a-sdk` 1.0.3 exact symbols** (`create_client` vs `ClientFactory`, server app class) — follow `a2a-samples`; gated, so non-blocking for core.
4. **`create_deep_agent` model arg form** (ChatModel instance vs `"openai:model"` string with custom base_url) — fallback documented.
5. **DBOS init/launch ordering** inside FastAPI lifespan — gated, fallback is direct execution.
6. **`web_search` package name** (`ddgs` vs `duckduckgo-search`) — verify on install.
