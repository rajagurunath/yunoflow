"""Agent model — holds the ~14 configurable dimensions."""
from __future__ import annotations

import uuid

from sqlalchemy import Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONType, TimestampMixin


def _default_memory() -> dict:
    return {"mode": "window", "window_size": 10, "summarize": False}


def _default_guardrails() -> dict:
    return {"max_steps": 12, "max_tokens": 20000, "max_cost_usd": 0.50, "allowed_tools": []}


def _default_personality() -> dict:
    return {"tone": "professional", "traits": []}


class Agent(Base, TimestampMixin):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))                       # 1
    role: Mapped[str] = mapped_column(String(500))                       # 2
    system_prompt: Mapped[str] = mapped_column(Text, default="")         # 3
    model: Mapped[str] = mapped_column(String(120))                      # 4
    temperature: Mapped[float] = mapped_column(Float, default=0.7)       # 5
    top_p: Mapped[float] = mapped_column(Float, default=1.0)             # 6
    tools: Mapped[list] = mapped_column(JSONType, default=list)          # 7
    channels: Mapped[list] = mapped_column(JSONType, default=list)       # 8
    schedule_cron: Mapped[str | None] = mapped_column(String(120), nullable=True)  # 9
    memory: Mapped[dict] = mapped_column(JSONType, default=_default_memory)         # 10
    skills: Mapped[list] = mapped_column(JSONType, default=list)         # 11
    interaction_rules: Mapped[str] = mapped_column(Text, default="")     # 12
    guardrails: Mapped[dict] = mapped_column(JSONType, default=_default_guardrails)  # 13
    personality: Mapped[dict] = mapped_column(JSONType, default=_default_personality)  # 14
