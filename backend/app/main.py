"""FastAPI application factory + lifespan.

Lifespan wires the Postgres checkpointer, the executor, and channel polling.
"""
from __future__ import annotations

from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, channels, health, runs, templates, tools, workflows, ws
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

    # Scheduler: register cron jobs for agents that have schedule_cron.
    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Agent
    from app.scheduling import scheduler as sched

    sched.start()
    async with SessionLocal() as s:
        scheduled = (await s.execute(select(Agent).where(Agent.schedule_cron.isnot(None)))).scalars().all()
    for a in scheduled:
        sched.schedule_agent(a.id, a.schedule_cron)

    # Seed the prebuilt templates (idempotent).
    from app.templates.seed import seed
    try:
        await seed()
    except Exception as exc:  # noqa: BLE001
        log.warning("seed.failed", error=str(exc))

    try:
        yield
    finally:
        log.info("app.shutdown")
        sched.shutdown()
        await manager.stop_all()
        await stack.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="Yuno Orchestrator", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_error_handlers(app)

    app.include_router(health.router)       # /health, /readyz
    app.include_router(agents.router)       # /api/agents
    app.include_router(tools.router)        # /api/tools
    app.include_router(workflows.router)    # /api/workflows
    app.include_router(templates.router)    # /api/templates
    app.include_router(channels.router)     # /api/channels
    app.include_router(runs.router)         # /api/runs
    app.include_router(ws.router)           # /api/ws/runs/{id}

    return app


app = create_app()
