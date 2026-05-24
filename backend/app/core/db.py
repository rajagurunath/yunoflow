"""Async SQLAlchemy engine + session factory."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool: open a fresh connection per session and close it after. Slightly less
# efficient than pooling, but it sidesteps asyncio cross-event-loop connection
# reuse (important for tests) and is plenty for a local-first demo.
engine = create_async_engine(settings.database_url, poolclass=NullPool, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a request-scoped DB session."""
    async with SessionLocal() as session:
        yield session
