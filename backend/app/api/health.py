"""Health + readiness endpoints (mounted at root, no /api prefix)."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.core.db import engine

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz() -> dict:
    """Readiness: confirm the database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "db": "ok"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "degraded", "db": str(exc)}
