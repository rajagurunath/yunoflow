"""Condition (router) node — writes state['route'], which conditional edges read.

Modes:
  value : route = str(scratch[key])                 (deterministic)
  expr  : route = eval(expr) over a restricted env  (trusted workflow authors)
  llm   : an LLM classifies the conversation into one of the branch labels
"""
from __future__ import annotations

from langchain_core.messages import SystemMessage

from app.core import llm as llm_module
from app.core.config import settings
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
    options = ", ".join(labels)
    instruction = (
        (prompt or "Classify the user's request into one category.")
        + f"\nRespond with EXACTLY ONE of these labels and nothing else: {options}."
    )
    # Route on the user's actual request (last human turn), not intermediate
    # agent chatter which would otherwise bias the classifier.
    last_human = next((m for m in reversed(messages) if getattr(m, "type", "") == "human"), None)
    context = [last_human] if last_human is not None else list(messages)
    resp = await factory(model=model, temperature=0).ainvoke([SystemMessage(content=instruction), *context])
    text = str(getattr(resp, "content", "") or "").strip().lower()
    # 1) exact match (the model followed instructions)
    for label in labels:
        if text == label.lower():
            return label
    # 2) otherwise pick the label mentioned earliest in the reply
    best, best_pos = None, len(text) + 1
    for label in labels:
        pos = text.find(label.lower())
        if pos != -1 and pos < best_pos:
            best, best_pos = label, pos
    return best


def make_condition_node(data: dict, llm_factory=None):
    branches = data.get("branches", []) or []
    labels = [b.get("label") for b in branches]
    default = data.get("default") or (labels[0] if labels else None)
    mode = data.get("mode", "llm")
    model = data.get("model") or settings.llm_model

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
