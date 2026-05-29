"""Async SQLAlchemy engine + session factory."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool (default, db_pool_size=0): a fresh connection per session — sidesteps
# asyncio cross-event-loop reuse (important for tests) and is fine for a local DB.
# A *remote* DB (Supabase) is slow that way (TLS handshake per request), so prod
# sets DB_POOL_SIZE>0 to keep a warm, reused connection pool.
if settings.db_pool_size > 0:
    engine = create_async_engine(
        settings.database_url, future=True,
        pool_size=settings.db_pool_size, max_overflow=settings.db_pool_size,
        pool_pre_ping=True, pool_recycle=300,
    )
else:
    engine = create_async_engine(settings.database_url, poolclass=NullPool, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a request-scoped DB session."""
    async with SessionLocal() as session:
        yield session
