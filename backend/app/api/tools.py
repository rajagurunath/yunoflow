"""Lists registered tools (the frontend's tool picker reads this)."""
from __future__ import annotations

from fastapi import APIRouter

from app.tools import list_specs

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("")
async def get_tools() -> list[dict]:
    return list_specs()
