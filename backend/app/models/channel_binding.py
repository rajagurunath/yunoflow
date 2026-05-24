"""ChannelBinding model — binds an external channel (Telegram) to an entrypoint."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONType, TimestampMixin


class ChannelBinding(Base, TimestampMixin):
    __tablename__ = "channel_bindings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    workflow_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    channel_type: Mapped[str] = mapped_column(String(32))  # "telegram"
    config_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    external_chat_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
