"""Run + message API schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RunInput(BaseModel):
    message: str | None = None
    vars: dict = Field(default_factory=dict)


class RunCreate(BaseModel):
    workflow_id: uuid.UUID | None = None
    agent_ids: list[uuid.UUID] | None = None  # [researcher, writer] for P1
    input: RunInput = Field(default_factory=RunInput)
    channel: str = "internal"


class RunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workflow_id: uuid.UUID
    status: str
    total_tokens: int
    total_cost_usd: float
    error: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_id: uuid.UUID
    role: str
    content: str
    sender_agent_id: uuid.UUID | None = None
    recipient_agent_id: uuid.UUID | None = None
    tokens: int
    cost_usd: float
    channel: str
    node_id: str | None = None
    created_at: datetime


class ResumeRequest(BaseModel):
    value: str


class UsageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_id: str | None = None
    model: str | None = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    created_at: datetime


class UsageSummary(BaseModel):
    items: list[UsageRead]
    total_tokens: int
    total_cost_usd: float
