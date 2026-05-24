"""Channel abstraction — implement this to add Slack / WhatsApp / etc.

To add a channel: subclass Channel, implement start/stop/send, and register it
in channels/manager.py's factory. No changes to the router or executor.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable

from pydantic import BaseModel, Field


class InboundMessage(BaseModel):
    channel_type: str
    external_chat_id: str
    text: str
    meta: dict = Field(default_factory=dict)


InboundHandler = Callable[[InboundMessage], Awaitable[None]]


class Channel(ABC):
    channel_type: str

    @abstractmethod
    async def start(self, on_inbound: InboundHandler) -> None: ...

    @abstractmethod
    async def stop(self) -> None: ...

    @abstractmethod
    async def send(self, external_chat_id: str, text: str) -> None: ...

    async def status(self) -> dict:
        return {"running": False}
