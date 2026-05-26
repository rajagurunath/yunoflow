"""Workflow API schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    graph_json: dict = Field(default_factory=dict)
    schedule_cron: str | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    graph_json: dict | None = None
    schedule_cron: str | None = None


class GenerateRequest(BaseModel):
    prompt: str


class WorkflowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    graph_json: dict
    schedule_cron: str | None = None
    created_at: datetime
    updated_at: datetime
