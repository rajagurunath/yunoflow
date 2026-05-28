"""Channel bindings: CRUD + live status.

A binding with a `bot_token` connects a dedicated Telegram bot (started live);
without one it binds against the shared default bot.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.core.errors import AppError, NotFoundError
from app.core.logging import get_logger
from app.models import ChannelBinding
from app.schemas.channel import ChannelBindingCreate, ChannelBindingRead

router = APIRouter(prefix="/api/channels", tags=["channels"])
log = get_logger(__name__)


def _read(b: ChannelBinding) -> ChannelBindingRead:
    cfg = b.config_json or {}
    return ChannelBindingRead(
        id=b.id, channel_type=b.channel_type, agent_id=b.agent_id,
        workflow_id=b.workflow_id, external_chat_id=b.external_chat_id,
        active=b.active, created_at=b.created_at,
        bot_username=cfg.get("bot_username"), label=cfg.get("label"),
        has_token=bool(cfg.get("bot_token")),
        notify_chat_id=cfg.get("notify_chat_id"),
    )


@router.get("", response_model=list[ChannelBindingRead])
async def list_bindings(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ChannelBinding).order_by(ChannelBinding.created_at))).scalars().all()
    return [_read(b) for b in rows]


@router.post("", response_model=ChannelBindingRead, status_code=status.HTTP_201_CREATED)
async def create_binding(body: ChannelBindingCreate, request: Request,
                         db: AsyncSession = Depends(get_db)):
    config: dict = {}
    if body.label:
        config["label"] = body.label
    if body.notify_chat_id:
        config["notify_chat_id"] = body.notify_chat_id.strip()
    if body.bot_token:
        if settings.telegram_bot_token and body.bot_token == settings.telegram_bot_token:
            raise AppError("that token is already the shared default bot",
                           code="duplicate_token", status_code=400)
        # Validate the token (and grab its @username) before persisting.
        from app.channels.telegram import validate_token
        try:
            username = await validate_token(body.bot_token)
        except Exception as exc:  # noqa: BLE001
            log.warning("channel.token_invalid", error=str(exc))
            raise AppError("invalid Telegram bot token", code="invalid_token",
                           status_code=400) from exc
        config.update({"bot_token": body.bot_token, "bot_username": username})

    binding = ChannelBinding(
        channel_type=body.channel_type, agent_id=body.agent_id,
        workflow_id=body.workflow_id, config_json=config,
    )
    db.add(binding)
    await db.commit()
    await db.refresh(binding)

    # Start the dedicated bot immediately (failure shouldn't lose the binding).
    if body.bot_token:
        manager = getattr(request.app.state, "channel_manager", None)
        if manager is not None:
            try:
                await manager.add_telegram_bot(binding)
            except Exception as exc:  # noqa: BLE001
                log.warning("channel.bot_start_failed", binding=str(binding.id), error=str(exc))

    return _read(binding)


@router.delete("/{binding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_binding(binding_id: uuid.UUID, request: Request,
                         db: AsyncSession = Depends(get_db)):
    binding = await db.get(ChannelBinding, binding_id)
    if binding is None:
        raise NotFoundError(f"channel binding {binding_id} not found")
    manager = getattr(request.app.state, "channel_manager", None)
    if manager is not None:
        await manager.remove_telegram_bot(str(binding_id))
    await db.delete(binding)
    await db.commit()


@router.get("/status")
async def channels_status(request: Request) -> dict:
    manager = getattr(request.app.state, "channel_manager", None)
    if manager is None:
        return {"telegram": {"running": False}, "bindings": {}}
    return await manager.status()
