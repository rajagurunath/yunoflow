"""FastAPI application factory + lifespan.

Lifespan wires the Postgres checkpointer, the executor, and channel polling.
"""
from __future__ import annotations

from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, health, runs
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

    # Checkpointer (persistence/memory/interrupt-resume) + executor.
    from app.runtime.checkpointer import open_postgres_checkpointer
    from app.runtime.executor import Executor

    checkpointer = await open_postgres_checkpointer(stack)
    app.state.executor = Executor(checkpointer)

    # Channels (Telegram long-polling, if a token is configured).
    from app.channels.manager import ChannelManager
    from app.channels.router import ChannelRouter

    router = ChannelRouter(app.state.executor)
    manager = ChannelManager()
    await manager.start_all(router)
    app.state.channel_manager = manager

    try:
        yield
    finally:
        log.info("app.shutdown")
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
    app.include_router(runs.router)         # /api/runs

    return app


app = create_app()
