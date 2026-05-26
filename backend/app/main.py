"""FastAPI application factory + lifespan.

Lifespan wires the Postgres checkpointer, the executor, and channel polling.
"""
from __future__ import annotations

from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    a2a, agents, auth, channels, health, metrics, runs, templates, tools, workflows, ws,
)
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging, get_logger

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log.info("app.startup")
    app.state.tasks = set()

    stack = AsyncExitStack()
    app.state.stack = stack

    # Deep observability (flagged): MLflow autolog.
    from app.observability.mlflow_tracing import setup_mlflow
    setup_mlflow()

    # Checkpointer + event bus + executor.
    from app.runtime.checkpointer import open_postgres_checkpointer
    from app.runtime.events import EventBus
    from app.runtime.executor import Executor

    checkpointer = await open_postgres_checkpointer(stack)
    app.state.event_bus = EventBus()
    app.state.executor = Executor(checkpointer, bus=app.state.event_bus)

    # Channels (Telegram long-polling, if a token is configured).
    from app.channels.manager import ChannelManager
    from app.channels.router import ChannelRouter

    router = ChannelRouter(app.state.executor)
    manager = ChannelManager()
    await manager.start_all(router)
    app.state.channel_manager = manager

    # Scheduler: cron jobs for agents/workflows. The launcher turns a fired job
    # into a real run (agent -> single-agent graph; workflow -> its own graph).
    import asyncio
    import uuid as _uuid

    from langchain_core.messages import HumanMessage
    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Agent, Workflow, WorkflowRun
    from app.runtime.builder import build_graph_for_workflow, build_single_agent_graph
    from app.scheduling import scheduler as sched
    from app.tools.guardrails import budget_for, recursion_limit_for

    async def _launch(kind: str, ident: str) -> None:
        executor = app.state.executor
        async with SessionLocal() as s:
            if kind == "workflow":
                wf = await s.get(Workflow, _uuid.UUID(ident))
                if wf is None:
                    return
                graph, agents = await build_graph_for_workflow(s, wf, executor.cp)
                wf_id, trigger = wf.id, "Scheduled run."
            else:
                agent = await s.get(Agent, _uuid.UUID(ident))
                if agent is None:
                    return
                graph, agents = build_single_agent_graph(agent, executor.cp), [agent]
                wf_id, trigger = None, f"Scheduled run for {agent.name}."
            run = WorkflowRun(workflow_id=wf_id, status="pending")
            s.add(run)
            await s.commit()
            await s.refresh(run)
            run_id = run.id

        rlimit = recursion_limit_for(agents)
        max_tokens, max_cost = budget_for(agents)
        task = asyncio.create_task(executor.run(
            run_id, graph, {"messages": [HumanMessage(content=trigger)], "scratch": {}},
            recursion_limit=rlimit, max_tokens=max_tokens, max_cost=max_cost))
        app.state.tasks.add(task)
        task.add_done_callback(app.state.tasks.discard)

    sched.set_launcher(_launch)
    sched.start()
    async with SessionLocal() as s:
        sched_agents = (await s.execute(select(Agent).where(Agent.schedule_cron.isnot(None)))).scalars().all()
        sched_wfs = (await s.execute(select(Workflow).where(Workflow.schedule_cron.isnot(None)))).scalars().all()
    for a in sched_agents:
        sched.schedule_agent(a.id, a.schedule_cron)
    for w in sched_wfs:
        sched.schedule_workflow(w.id, w.schedule_cron)

    # Seed the prebuilt templates (idempotent).
    from app.templates.seed import seed
    try:
        await seed()
    except Exception as exc:  # noqa: BLE001
        log.warning("seed.failed", error=str(exc))

    # Durable execution (gated, default off; no-op without [dbos] extra/flag).
    from app.scheduling.dbos_workflows import init_dbos, shutdown_dbos
    init_dbos()

    try:
        yield
    finally:
        log.info("app.shutdown")
        shutdown_dbos()
        sched.shutdown()
        await manager.stop_all()
        await stack.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="YunoFlow", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_error_handlers(app)

    app.include_router(health.router)       # /health, /readyz
    app.include_router(auth.router)         # /api/auth/login
    app.include_router(agents.router)       # /api/agents
    app.include_router(tools.router)        # /api/tools
    app.include_router(workflows.router)    # /api/workflows
    app.include_router(templates.router)    # /api/templates
    app.include_router(channels.router)     # /api/channels
    app.include_router(metrics.router)      # /api/metrics
    app.include_router(a2a.router)          # /api/a2a (agent card discovery)
    app.include_router(runs.router)         # /api/runs
    app.include_router(ws.router)           # /api/ws/runs/{id}

    return app


app = create_app()
