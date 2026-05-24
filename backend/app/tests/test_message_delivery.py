"""Critical path: channel message delivery (inbound -> agent -> outbound)."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.channels.base import InboundMessage
from app.channels.router import ChannelRouter
from app.core.db import SessionLocal
from app.models import Message


@pytest.mark.asyncio
async def test_message_delivery(executor, two_agents):
    replies: list[tuple[str, str]] = []

    async def send(chat_id: str, text: str) -> None:
        replies.append((chat_id, text))

    router = ChannelRouter(executor, send=send)
    await router.handle_inbound(
        InboundMessage(channel_type="telegram", external_chat_id="123", text="hi there")
    )

    assert replies, "expected at least one outbound reply"
    chat_id, text = replies[-1]
    assert chat_id == "123"
    assert text  # non-empty final answer

    async with SessionLocal() as s:
        tg_msgs = (await s.execute(select(Message).where(Message.channel == "telegram"))).scalars().all()

    # inbound user message persisted on the telegram channel
    assert any(m.role == "user" and m.external_chat_id == "123" for m in tg_msgs)
