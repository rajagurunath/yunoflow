"""Shared FastAPI dependencies."""
from __future__ import annotations

from fastapi import Request

from app.core.db import get_db  # re-export for routers
from app.runtime.executor import Executor

__all__ = ["get_db", "get_executor"]


def get_executor(request: Request) -> Executor:
    return request.app.state.executor
