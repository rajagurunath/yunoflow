"""Tool registry.

To add a tool: write a function with a docstring and decorate it with
@register("name"). It becomes LangChain-bindable and self-describing via
GET /api/tools. allowed_tools (a guardrail) narrows what an agent may use.
"""
from __future__ import annotations

from dataclasses import dataclass

from langchain_core.tools import tool as lc_tool


@dataclass
class ToolSpec:
    name: str
    lc_tool: object
    description: str
    side_effecting: bool


REGISTRY: dict[str, ToolSpec] = {}


def register(name: str, *, side_effecting: bool = False):
    def deco(fn):
        structured = lc_tool(fn)  # name from fn.__name__, schema from signature+docstring
        REGISTRY[name] = ToolSpec(
            name=name,
            lc_tool=structured,
            description=(fn.__doc__ or "").strip(),
            side_effecting=side_effecting,
        )
        return fn

    return deco


def resolve(names: list[str] | None, guardrails: dict | None = None) -> list:
    """Return LangChain tool objects for the requested names, filtered by
    the agent's allowed_tools guardrail (empty allowed_tools => all requested)."""
    names = names or []
    allowed = set((guardrails or {}).get("allowed_tools") or names)
    return [REGISTRY[n].lc_tool for n in names if n in REGISTRY and n in allowed]


def list_specs() -> list[dict]:
    return [
        {"name": s.name, "description": s.description, "side_effecting": s.side_effecting}
        for s in REGISTRY.values()
    ]
