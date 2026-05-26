"""Channel binding API schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChannelBindingCreate(BaseModel):
    channel_type: str = "telegram"
    agent_id: uuid.UUID | None = None
    workflow_id: uuid.UUID | None = None
    # Provide a bot_token to connect a *dedicated* Telegram bot for this workflow.
    # Omit it to bind against the shared default bot (TELEGRAM_BOT_TOKEN).
    bot_token: str | None = None
    label: str | None = None


class ChannelBindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_type: str
    agent_id: uuid.UUID | None = None
    workflow_id: uuid.UUID | None = None
    external_chat_id: str | None = None
    active: bool
    created_at: datetime
    # Surfaced from config_json (the token itself is never returned).
    bot_username: str | None = None
    label: str | None = None
    has_token: bool = False
