"""Channel bindings: CRUD + live status."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.errors import NotFoundError
from app.models import ChannelBinding
from app.schemas.channel import ChannelBindingCreate, ChannelBindingRead

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.get("", response_model=list[ChannelBindingRead])
async def list_bindings(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(ChannelBinding).order_by(ChannelBinding.created_at))).scalars().all()


@router.post("", response_model=ChannelBindingRead, status_code=status.HTTP_201_CREATED)
async def create_binding(body: ChannelBindingCreate, db: AsyncSession = Depends(get_db)):
    binding = ChannelBinding(**body.model_dump())
    db.add(binding)
    await db.commit()
    await db.refresh(binding)
    return binding


@router.delete("/{binding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_binding(binding_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    binding = await db.get(ChannelBinding, binding_id)
    if binding is None:
        raise NotFoundError(f"channel binding {binding_id} not found")
    await db.delete(binding)
    await db.commit()


@router.get("/status")
async def channels_status(request: Request) -> dict:
    manager = getattr(request.app.state, "channel_manager", None)
    if manager is None:
        return {"telegram": {"running": False}}
    return await manager.status()
