"""Agent CRUD."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.errors import NotFoundError
from app.models import Agent
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[AgentRead])
async def list_agents(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Agent).order_by(Agent.created_at))).scalars().all()
    return rows


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_agent(body: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent = Agent(**body.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise NotFoundError(f"agent {agent_id} not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentRead)
async def update_agent(agent_id: uuid.UUID, body: AgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise NotFoundError(f"agent {agent_id} not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise NotFoundError(f"agent {agent_id} not found")
    await db.delete(agent)
    await db.commit()
