"""Shared graph state for the agent runtime."""
from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    """State threaded through the graph.

    ``messages`` uses the add_messages reducer so each node appends rather than
    overwrites — this is the asynchronous agent-to-agent channel.
    """

    messages: Annotated[list[BaseMessage], add_messages]
    route: str | None          # last condition decision (P2+)
    scratch: dict              # free-form inter-agent shared data
    step: int                  # node counter (guardrails, P3+)
    run_id: str
