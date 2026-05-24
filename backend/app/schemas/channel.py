"""Channel binding API schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChannelBindingCreate(BaseModel):
    channel_type: str = "telegram"
    agent_id: uuid.UUID | None = None
    workflow_id: uuid.UUID | None = None
    config_json: dict = Field(default_factory=dict)


class ChannelBindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_type: str
    agent_id: uuid.UUID | None = None
    workflow_id: uuid.UUID | None = None
    external_chat_id: str | None = None
    active: bool
    created_at: datetime
