"""Agent API schemas — exposes the ~14 configurable dimensions."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GuardrailsModel(BaseModel):
    max_steps: int = 12
    max_tokens: int = 20000
    max_cost_usd: float = 0.50
    allowed_tools: list[str] = Field(default_factory=list)


class MemoryModel(BaseModel):
    mode: Literal["none", "window", "persistent"] = "window"
    window_size: int = 10
    summarize: bool = False


class PersonalityModel(BaseModel):
    tone: str = "professional"
    traits: list[str] = Field(default_factory=list)


class AgentBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    role: str
    system_prompt: str = ""
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    top_p: float = 1.0
    tools: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)
    schedule_cron: str | None = None
    memory: MemoryModel = Field(default_factory=MemoryModel)
    skills: list[str] = Field(default_factory=list)
    interaction_rules: str = ""
    guardrails: GuardrailsModel = Field(default_factory=GuardrailsModel)
    personality: PersonalityModel = Field(default_factory=PersonalityModel)


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = None
    role: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    tools: list[str] | None = None
    channels: list[str] | None = None
    schedule_cron: str | None = None
    memory: MemoryModel | None = None
    skills: list[str] | None = None
    interaction_rules: str | None = None
    guardrails: GuardrailsModel | None = None
    personality: PersonalityModel | None = None


class AgentRead(AgentBase):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
