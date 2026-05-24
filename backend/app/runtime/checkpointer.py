"""LangGraph checkpointer lifecycle.

The app uses a Postgres-backed AsyncPostgresSaver kept open for the process
lifetime (persistence, memory, interrupt/resume). Tests swap in an InMemorySaver.
"""
from __future__ import annotations

from contextlib import AsyncExitStack
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

_holder: dict[str, Any] = {"cp": None}


async def open_postgres_checkpointer(stack: AsyncExitStack):
    """Open + setup an AsyncPostgresSaver bound to the process lifetime."""
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    cp = await stack.enter_async_context(
        AsyncPostgresSaver.from_conn_string(settings.checkpoint_db_uri)
    )
    await cp.setup()
    _holder["cp"] = cp
    log.info("checkpointer.ready", backend="postgres")
    return cp


def in_memory_checkpointer():
    try:
        from langgraph.checkpoint.memory import InMemorySaver

        return InMemorySaver()
    except ImportError:  # older naming
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()


def get_checkpointer():
    return _holder["cp"]


def set_checkpointer(cp) -> None:
    _holder["cp"] = cp
