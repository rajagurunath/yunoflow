"""Human-in-the-loop node: pauses the graph until a human replies.

Reaching this node calls LangGraph's ``interrupt()``, which checkpoints the run
and stops. The executor surfaces the question (over Telegram for channel/web/
scheduled runs, and on the WebSocket activity log). When a human replies, the
run is resumed with their text as the interrupt value, which this node appends
to the shared message history as a ``[human]`` turn so downstream agents see it.
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage
from langgraph.types import interrupt

from app.runtime.state import AgentState

DEFAULT_PROMPT = "Human approval needed — review the work so far and reply to continue."


def make_human_node(data: dict | None = None):
    prompt = (data or {}).get("prompt") or DEFAULT_PROMPT

    async def node(state: AgentState) -> dict:
        answer = interrupt({"question": prompt})
        return {"messages": [HumanMessage(content=f"[human] {answer}")]}

    return node
