"""A2A discovery endpoints — expose agents as A2A Agent Cards."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.errors import NotFoundError
from app.models import Agent
from app.protocols.a2a.cards import build_agent_card

router = APIRouter(prefix="/api/a2a", tags=["a2a"])


@router.get("/agents")
async def list_agent_cards(request: Request, db: AsyncSession = Depends(get_db)) -> list[dict]:
    base = str(request.base_url)
    agents = (await db.execute(select(Agent).order_by(Agent.created_at))).scalars().all()
    return [build_agent_card(a, base) for a in agents]


@router.get("/agents/{agent_id}")
async def get_agent_card(agent_id: uuid.UUID, request: Request,
                         db: AsyncSession = Depends(get_db)) -> dict:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise NotFoundError(f"agent {agent_id} not found")
    return build_agent_card(agent, str(request.base_url))
