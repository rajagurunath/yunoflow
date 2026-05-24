"""Message model — doubles as conversation history AND inter-agent monitor feed."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_runs.id", ondelete="CASCADE"), index=True
    )
    sender_agent_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    recipient_agent_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    role: Mapped[str] = mapped_column(String(20))  # system|user|assistant|tool
    content: Mapped[str] = mapped_column(Text, default="")
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    channel: Mapped[str] = mapped_column(String(32), default="internal")  # internal|telegram
    external_chat_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    node_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
