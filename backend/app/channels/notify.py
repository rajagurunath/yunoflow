"""Proactive outbound: push a run's interrupt question / final answer to the
workflow's bound Telegram chat.

Channel-initiated runs already have a reply transport (the inbound chat). Web-
console and scheduled runs don't — so an interrupt would otherwise pause
silently. ``workflow_notifier`` builds an ``on_reply(text)`` for those runs by
resolving a ChannelBinding for the workflow that carries a chat id (set in the
Channels page, or auto-captured the first time someone messages the bot). It
also tags the run with that chat id so an inbound reply resumes the right run.
Returns ``None`` when no chat is bound (the run then proceeds with no replies).
"""
from __future__ import annotations

from sqlalchemy import select

from app.channels.telegram import TelegramChannel
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.models import ChannelBinding, Message

log = get_logger(__name__)


def _chat_id(binding: ChannelBinding) -> str | None:
    cfg = binding.config_json or {}
    return cfg.get("notify_chat_id") or binding.external_chat_id


async def workflow_notifier(workflow_id, run_id):
    if workflow_id is None:
        return None

    async with SessionLocal() as s:
        rows = (await s.execute(
            select(ChannelBinding).where(
                ChannelBinding.channel_type == "telegram",
                ChannelBinding.active.is_(True),
                ChannelBinding.workflow_id == workflow_id,
            ).order_by(ChannelBinding.created_at.desc())
        )).scalars().all()

    binding = next((b for b in rows if _chat_id(b)), None)
    if binding is None:
        return None
    chat_id = _chat_id(binding)
    token = (binding.config_json or {}).get("bot_token") or settings.telegram_bot_token
    if not token or not chat_id:
        return None

    channel = TelegramChannel(token)

    async def on_reply(text: str) -> None:
        try:
            await channel.send(str(chat_id), text)
        except Exception as exc:  # noqa: BLE001
            log.warning("notify.send_failed", workflow=str(workflow_id), error=str(exc))
            return
        # Tag the run with this chat so the inbound reply resumes *this* run.
        async with SessionLocal() as s:
            s.add(Message(run_id=run_id, role="assistant", content=text,
                          channel="telegram", external_chat_id=str(chat_id)))
            await s.commit()

    return on_reply
