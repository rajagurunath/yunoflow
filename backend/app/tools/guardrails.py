"""Guardrail helpers — derive runtime limits from agent guardrail config."""
from __future__ import annotations

DEFAULTS = {"max_steps": 12, "max_tokens": 20000, "max_cost_usd": 0.50}


def _g(agent) -> dict:
    return getattr(agent, "guardrails", None) or {}


def recursion_limit_for(agents) -> int:
    steps = max((_g(a).get("max_steps", DEFAULTS["max_steps"]) for a in agents), default=DEFAULTS["max_steps"])
    return max(4, steps * 2 + 4)  # buffer: agent + tool steps per logical step


def budget_for(agents) -> tuple[int, float]:
    max_tokens = max((_g(a).get("max_tokens", DEFAULTS["max_tokens"]) for a in agents),
                     default=DEFAULTS["max_tokens"])
    max_cost = max((_g(a).get("max_cost_usd", DEFAULTS["max_cost_usd"]) for a in agents),
                   default=DEFAULTS["max_cost_usd"])
    return max_tokens, max_cost
