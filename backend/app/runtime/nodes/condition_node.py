"""Condition (router) node — writes state['route'], which conditional edges read.

Modes:
  value : route = str(scratch[key])                 (deterministic)
  expr  : route = eval(expr) over a restricted env  (trusted workflow authors)
  llm   : an LLM classifies the conversation into one of the branch labels
"""
from __future__ import annotations

from langchain_core.messages import SystemMessage

from app.core import llm as llm_module
from app.core.logging import get_logger
from app.runtime.state import AgentState

log = get_logger(__name__)


def _safe_eval(expr: str, state: AgentState):
    # Restricted: no builtins; only len + state slices exposed. Workflow authors
    # are trusted platform users (same trust level as writing a system prompt).
    env = {
        "messages": state.get("messages", []) or [],
        "scratch": state.get("scratch", {}) or {},
        "step": state.get("step", 0) or 0,
        "len": len,
    }
    return eval(expr, {"__builtins__": {}}, env)  # noqa: S307


async def _classify(factory, messages, labels, prompt, model) -> str | None:
    instruction = (prompt or "Classify the conversation into one category.") + (
        f" Reply with exactly one of: {', '.join(labels)}."
    )
    resp = await factory(model=model, temperature=0).ainvoke([SystemMessage(content=instruction), *messages])
    text = str(getattr(resp, "content", "") or "").lower()
    for label in labels:
        if label.lower() in text:
            return label
    return None


def make_condition_node(data: dict, llm_factory=None):
    branches = data.get("branches", []) or []
    labels = [b.get("label") for b in branches]
    default = data.get("default") or (labels[0] if labels else None)
    mode = data.get("mode", "llm")
    model = data.get("model", "gpt-4o-mini")

    async def node(state: AgentState) -> dict:
        route = None
        try:
            if mode == "value":
                route = str((state.get("scratch") or {}).get(data.get("key")))
            elif mode == "expr":
                route = _safe_eval(data.get("expr", ""), state)
            else:  # llm
                factory = llm_factory or llm_module.build_chat_model
                route = await _classify(factory, state.get("messages", []), labels, data.get("prompt"), model)
        except Exception as exc:  # noqa: BLE001
            log.warning("condition.eval_failed", error=str(exc))
            route = None
        if route not in labels:
            route = default
        return {"route": route}

    return node
