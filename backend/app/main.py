"""FastAPI application factory + lifespan.

P0: boots the web app, wires logging + error handlers, exposes /health.
Later phases extend the lifespan (scheduler, channels, mlflow) and routers.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging, get_logger

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log.info("app.startup")
    # Future phases: start scheduler, channels, mlflow autolog, checkpointer.setup()
    yield
    log.info("app.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(title="Yuno Orchestrator", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_error_handlers(app)

    # Health at root (no prefix); feature routers will mount under /api.
    app.include_router(health.router)

    return app


app = create_app()
