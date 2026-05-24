"""DeepAgent node (P5) — wraps LangChain's deepagents (planning + sub-agents +
virtual filesystem) as a single LangGraph node so it composes inside a workflow.

Used for long-horizon reasoning (e.g. the Dispute Investigator). Smoke-tested:
create_deep_agent accepts a BaseChatModel, so our configured ChatOpenAI is used.
"""
from __future__ import annotations

from app.core import llm as llm_module
from app.runtime.state import AgentState


def make_deepagent_node(agent, llm_factory=None, tool_resolver=None):
    tools = []
    if tool_resolver and getattr(agent, "tools", None):
        tools = tool_resolver(agent.tools, getattr(agent, "guardrails", None) or {})

    async def node(state: AgentState) -> dict:
        from deepagents import create_deep_agent

        factory = llm_factory or llm_module.build_chat_model
        model = factory(model=agent.model, temperature=getattr(agent, "temperature", 0.7))
        sub = create_deep_agent(
            model=model,
            tools=tools,
            system_prompt=agent.system_prompt or f"You are {agent.role}.",
        )
        result = await sub.ainvoke({"messages": state.get("messages", [])})
        # Append only the final answer to shared state (planning/sub-agent steps
        # ran internally within the deep agent).
        return {"messages": [result["messages"][-1]]}

    return node
