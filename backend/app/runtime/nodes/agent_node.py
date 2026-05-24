"""Generic LLM agent node built from a stored Agent's config."""
from __future__ import annotations

from langchain_core.messages import SystemMessage

from app.core import llm as llm_module
from app.runtime.state import AgentState


def make_agent_node(agent, llm_factory=None):
    async def node(state: AgentState) -> dict:
        factory = llm_factory or llm_module.build_chat_model
        model = factory(
            model=agent.model,
            temperature=getattr(agent, "temperature", 0.7),
            top_p=getattr(agent, "top_p", 1.0),
        )
        system = SystemMessage(content=agent.system_prompt or f"You are {agent.role}.")
        resp = await model.ainvoke([system, *state.get("messages", [])])
        return {"messages": [resp]}

    return node
