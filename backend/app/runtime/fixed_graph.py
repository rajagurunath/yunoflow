"""P1 fixed graph: researcher -> reviewer (optional human-in-the-loop) -> writer.

This is the hard-coded vertical slice. P2 replaces it with the Compiler that
builds graphs from a ReactFlow definition; the node helpers here are the seed
of that generic node library.
"""
from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.core import llm
from app.runtime.state import AgentState


def make_agent_node(node_id: str, agent):
    """An LLM node built from a stored Agent's config."""

    async def node(state: AgentState) -> dict:
        model = llm.build_chat_model(model=agent.model, temperature=agent.temperature)
        system = SystemMessage(content=agent.system_prompt or f"You are {agent.role}.")
        resp = await model.ainvoke([system, *state.get("messages", [])])
        return {"messages": [resp]}

    return node


async def reviewer_node(state: AgentState) -> dict:
    """Human-in-the-loop gate. Interrupts only when scratch.require_approval is set."""
    scratch = dict(state.get("scratch") or {})
    if scratch.get("require_approval"):
        answer = interrupt({"question": "Review the draft so far and add any context (reply 'ok' to proceed):"})
        scratch["require_approval"] = False
        return {"messages": [HumanMessage(content=f"[human] {answer}")], "scratch": scratch}
    return {}


def build_fixed_graph(researcher, writer, checkpointer):
    g = StateGraph(AgentState)
    g.add_node("researcher", make_agent_node("researcher", researcher))
    g.add_node("reviewer", reviewer_node)
    g.add_node("writer", make_agent_node("writer", writer))
    g.add_edge(START, "researcher")
    g.add_edge("researcher", "reviewer")
    g.add_edge("reviewer", "writer")
    g.add_edge("writer", END)
    return g.compile(checkpointer=checkpointer)
