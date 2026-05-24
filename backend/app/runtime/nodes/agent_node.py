"""Generic LLM agent node built from a stored Agent's config.

When the agent has tools (and a resolver is provided), the node runs a ReAct
loop (LangGraph's prebuilt create_react_agent) so tools actually execute.
Otherwise it's a single LLM call.
"""
from __future__ import annotations

from langchain_core.messages import SystemMessage

from app.core import llm as llm_module
from app.runtime.state import AgentState


def make_agent_node(agent, llm_factory=None, tool_resolver=None):
    tools = []
    if tool_resolver and getattr(agent, "tools", None):
        tools = tool_resolver(agent.tools, getattr(agent, "guardrails", None) or {})

    async def node(state: AgentState) -> dict:
        factory = llm_factory or llm_module.build_chat_model
        model = factory(
            model=agent.model,
            temperature=getattr(agent, "temperature", 0.7),
            top_p=getattr(agent, "top_p", 1.0),
        )
        system = agent.system_prompt or f"You are {agent.role}."
        messages = state.get("messages", [])

        if tools:
            from langgraph.prebuilt import create_react_agent

            react = create_react_agent(model, tools, prompt=system)
            result = await react.ainvoke({"messages": messages})
            # Append only the final answer to shared state (tool steps ran internally).
            return {"messages": [result["messages"][-1]]}

        resp = await model.ainvoke([SystemMessage(content=system), *messages])
        return {"messages": [resp]}

    return node
