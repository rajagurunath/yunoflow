"""Tool node wrapper. The real tool registry arrives in P3; this wraps whatever
resolved LangChain tools it's given into LangGraph's prebuilt ToolNode."""
from __future__ import annotations


def make_tool_node(tools):
    from langgraph.prebuilt import ToolNode

    return ToolNode(tools or [])
