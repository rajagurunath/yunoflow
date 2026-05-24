# Agent Runtime Framework Selection

> Decision doc for the Yuno "AI Agent Orchestration Platform" challenge.
> This feeds directly into the README's required *"runtime choice justification."*

## What the challenge actually demands of the runtime

Re-reading the PDF, the runtime must support **six** capabilities. These are the columns we score on, because they map directly to the evaluation weights (demo 40% / architecture 30% / UI-UX 20% / docs 10%):

1. **Graph execution with conditions + feedback loops** — the visual builder is a directed graph with branching and cycles. The runtime must execute an arbitrary (possibly cyclic) graph, not a fixed pipeline.
2. **Asynchronous agent-to-agent communication** — explicit "Other Requirement"; also an impact metric ("agent-to-agent message reliability").
3. **Persisted memory / message history** — must survive restarts and be visible in the UI.
4. **Live monitoring** — real-time logs, inter-agent messages, token/cost tracking.
5. **Real tool execution** — agents call real tools, not mocked UI.
6. **Human-in-the-loop via an external channel** — a Telegram conversation must drive/observe a running graph.

A secondary, very real column for us: **how reliably can an autonomous Ralph loop generate correct code against this framework's API?** (API stability + documentation density + how "obvious" the primitives are.)

## Scorecard (1 = poor fit, 5 = excellent fit, for *this* challenge)

| Capability (→ rubric impact) | LangGraph | AutoGen (v0.4+) | CrewAI |
|---|:---:|:---:|:---:|
| **Graph w/ conditions + loops** (demo 40%, UX 20%) — maps to ReactFlow | **5** — `StateGraph` *is* a node/edge graph; `add_conditional_edges` = conditions; cycles are first-class | 4 — `GraphFlow`/`DiGraphBuilder` added in 0.4; works but newer, thinner docs | 2 — `Flow` (`@start/@listen/@router`) is decorator/code-shaped; dynamic arbitrary graphs from UI are awkward; Crews are sequential/hierarchical |
| **Async agent-to-agent comms** (demo 40%, reliability metric) | 4 — async graph execution + message passing via state | **5** — actor model / async message-passing *is* the core architecture | 3 — async supported; agent comms abstracted inside a crew, less explicit |
| **Persistence / memory / history** (demo 40%, architecture 30%) | **5** — built-in checkpointers (Postgres/SQLite) persist full state + history out of the box | 3 — has memory/state but persistence is more DIY | 3 — memory module exists; durable cross-run persistence is more manual |
| **Live monitoring** (UX 20%) — logs, inter-agent msgs, token/cost | **5** — native `stream`/`astream_events` emits every node + token; easy WebSocket bridge | 4 — event stream available; good | 3 — callbacks/listeners exist; less granular streaming |
| **Real tool execution** (demo 40%) | **5** — first-class `ToolNode` + bind_tools | **5** — first-class tool/function calling | **5** — first-class tools |
| **Human-in-the-loop / channel** (demo 40%) | **5** — `interrupt()` + checkpoint resume is purpose-built for "pause, ask human via Telegram, resume" | 3 — supported but more wiring | 3 — supported but more wiring |
| **Token / cost tracking** (UX 20%) | 4 — via callbacks / usage metadata on stream | 4 — usage in messages | 3 — available, less surfaced |
| **Per-agent config surface** (UX 20% — "# configurable dimensions") | 4 — we model config ourselves → full control over how many dimensions | 4 — agent objects are configurable | **5** — role/goal/backstory is a rich, ready-made config vocabulary |
| **Ralph-loop build reliability** (architecture 30%) — API stability + doc density | **5** — most documented agent framework; stable, "obvious" primitives → fewest LLM hallucinations | 3 — 0.2→0.4 was a big rewrite; mixed docs/examples online cause version confusion | 4 — well documented, but Flows vs Crews split can confuse generation |
| **Alignment with Yuno JD** (signal) | **5** — JD names **LangGraph** *and* **LangSmith** explicitly | 4 — JD names AutoGen | 4 — JD names CrewAI |
| **Local-first, single command** (demo 40%) | **5** — pure pip, SQLite checkpointer, no infra | 4 — pip; some setups pull extras | **5** — pip |
| **License** | MIT | MIT (CC-BY-4.0 docs) | MIT |
| **Weighted fit for this challenge** | **🥇 ~4.7** | 🥈 ~3.9 | 🥉 ~3.5 |

## Narrative read

- **LangGraph** wins because the challenge's hardest, highest-weighted requirement — *"visual workflow builder with conditions and feedback loops"* driving a real runtime — is a one-to-one mapping to its data model. A ReactFlow node becomes a graph node; a ReactFlow edge becomes an edge; a labeled/conditional ReactFlow edge becomes a conditional edge; a back-edge becomes a cycle. The features the rubric *separately* rewards (persistent memory, message history, live streaming/monitoring, human-in-the-loop) are **built-in primitives**, not things we hand-roll — which directly lifts the 30% architecture and 20% UX scores. And `interrupt()` + checkpoint-resume is almost custom-made for "the Telegram user is asked a question mid-workflow, replies, and the graph continues."

- **AutoGen (v0.4+)** is the strongest of your two original picks. Its async actor core is the best pure expression of "agents communicate asynchronously," and `GraphFlow` now covers graph execution. The cost: the 0.2→0.4 rewrite means a lot of stale examples online, which raises the chance a Ralph loop generates code against the wrong API version. Persistence is more DIY.

- **CrewAI** is the fastest to a *first* multi-agent result and has the richest ready-made agent-config vocabulary (role/goal/backstory). But it's the weakest fit for the central requirement: turning an arbitrary user-drawn graph (with conditions and loops) into an executing topology is awkward against Crews/Flows, and durable persistence/streaming need more manual work.

## Recommendation

**Build on LangGraph.** It maximizes the 40% (demo) and 30% (architecture) buckets by giving us graph-execution, persistence, message history, streaming-for-monitoring, and human-in-the-loop as native features, it maps cleanly to ReactFlow, it's the most Ralph-loop-friendly (stable, densely documented), and it directly echoes the Yuno JD (LangGraph + LangSmith).

**Optional flourish (only after the slice is green):** add one node type that internally runs an **AutoGen** `GroupChat` sub-team, so the README can credibly say "LangGraph for orchestration, AutoGen for free-form multi-agent debate." This demonstrates breadth without risking the core demo.

### Runtime-justification snippet for the README (draft)
> We chose **LangGraph** because the platform's core artifact — a user-drawn workflow with branching conditions and feedback loops — is structurally a directed graph with cycles, which is exactly LangGraph's `StateGraph` model. This let us map the ReactFlow canvas onto the execution engine one-to-one, and inherit persistence (checkpointers), full message-history replay, token-level streaming for live monitoring, and human-in-the-loop pausing as built-in capabilities rather than bespoke code — keeping a clean separation between the UI, the runtime, and the persistence layer.
