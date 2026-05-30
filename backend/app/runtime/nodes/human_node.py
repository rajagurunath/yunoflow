"""Human-in-the-loop node: pauses the graph until a human replies.

Reaching this node calls LangGraph's ``interrupt()``, which checkpoints the run
and stops. The executor surfaces the question (over Telegram for channel/web/
scheduled runs, and on the WebSocket activity log). When a human replies, the
run is resumed with their text as the interrupt value, which this node appends
to the shared message history as a ``[human]`` turn so downstream agents see it.

The interrupt question embeds the **preceding agent's output** (e.g. a triage
summary) so the approval prompt is self-contained — channel runs only forward
the interrupt question, not the intermediate agent messages.
"""
from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.types import interrupt

from app.runtime.state import AgentState

DEFAULT_PROMPT = "Human approval needed — review the work so far and reply to continue."


def make_human_node(data: dict | None = None):
    prompt = (data or {}).get("prompt") or DEFAULT_PROMPT

    async def node(state: AgentState) -> dict:
        messages = state.get("messages", []) or []
        summary = next(
            (m.content for m in reversed(messages)
             if isinstance(m, AIMessage) and (m.content or "").strip()),
            "",
        )
        question = f"{summary}\n\n———\n{prompt}" if summary else prompt
        answer = interrupt({"question": question})
        return {"messages": [HumanMessage(content=f"[human] {answer}")]}

    return node
