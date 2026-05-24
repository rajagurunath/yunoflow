"""Template API schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    graph_json: dict
    created_at: datetime


class InstantiateRequest(BaseModel):
    name: str | None = None
