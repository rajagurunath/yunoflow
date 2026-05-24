"""Natural-language → workflow generator.

An LLM turns a plain-English (or voice-transcribed) request into a structured
workflow spec; we then create the agents and a runnable workflow graph. This is
the "describe it and it builds itself" / vibe-coding-a-flow capability.
"""
from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.core import llm as llm_module
from app.tools import registry

_SCHEMA = """You design multi-agent workflows for an orchestration platform.
Given the user's request, reply with ONLY a JSON object (no prose, no code fences):

{
  "name": "<short title>",
  "description": "<one line>",
  "agents": [
    {"key": "triage", "name": "Triage", "role": "<role>", "system_prompt": "<prompt>", "tools": ["read_kb"]}
  ],
  "nodes": [
    {"id": "start", "type": "start"},
    {"id": "triage", "type": "agent", "agent": "triage"},
    {"id": "route", "type": "condition", "prompt": "Is this a refund or an info request?",
     "branches": ["refund", "info"], "default": "info"},
    {"id": "end", "type": "end"}
  ],
  "edges": [
    {"source": "start", "target": "triage"},
    {"source": "triage", "target": "route"},
    {"source": "route", "target": "refund_agent", "when": "refund"}
  ]
}

Rules:
- Exactly one `start` node and at least one `end` node; node ids are unique.
- `agent` nodes reference an agent by its `key` from `agents`.
- `condition` nodes need >=2 branches; every edge LEAVING a condition MUST carry a
  `when` matching one of that condition's branch labels, and a `default` is set.
- Use ONLY these tools when an agent needs them: {tools}.
- Keep it focused: 2-5 agents. Make system prompts concrete and useful."""


async def generate_workflow_spec(prompt: str) -> dict:
    tools = ", ".join(sorted(registry.REGISTRY)) or "(none)"
    # NB: _SCHEMA contains a literal JSON example (many braces) — use replace(),
    # not str.format(), which would treat those braces as format fields.
    system = _SCHEMA.replace("{tools}", tools)
    model = llm_module.build_chat_model(temperature=0.2)
    resp = await model.ainvoke([SystemMessage(content=system), HumanMessage(content=prompt)])
    return _extract_json(str(getattr(resp, "content", "") or ""))


def _extract_json(text: str) -> dict:
    """Tolerantly pull the JSON object out of an LLM reply."""
    text = text.strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("model did not return a JSON workflow spec")
    return json.loads(text[start:end + 1])


def spec_to_graph_json(spec: dict, keymap: dict[str, str]) -> dict:
    """Pure mapping from an LLM spec + {agent_key: agent_id} to ReactFlow graph_json."""
    nodes = []
    for n in spec.get("nodes", []):
        ntype = n.get("type")
        data: dict = {}
        if ntype in ("agent", "deepagent"):
            data = {"agent_id": keymap.get(n.get("agent"))}
        elif ntype == "condition":
            data = {
                "mode": "llm",
                "prompt": n.get("prompt", "Classify the request."),
                "branches": [{"label": b} for b in n.get("branches", [])],
                "default": n.get("default") or (n.get("branches") or [None])[0],
            }
        elif ntype == "tool":
            data = {"tools": n.get("tools", [])}
        nodes.append({"id": n["id"], "type": ntype, "data": data})

    edges = []
    for i, e in enumerate(spec.get("edges", [])):
        when = e.get("when")
        edges.append({
            "id": e.get("id", f"e{i}"), "source": e["source"], "target": e["target"],
            "data": {"when": when} if when else {}, "label": when,
        })
    return {"nodes": nodes, "edges": edges}
