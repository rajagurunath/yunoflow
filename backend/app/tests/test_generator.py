"""NL-generator: the pure spec -> graph_json mapping (LLM call not exercised)."""
from __future__ import annotations

import pytest

from app.runtime.generator import spec_to_graph_json

SPEC = {
    "name": "Refund Triage",
    "agents": [
        {"key": "triage", "name": "Triage", "role": "router", "tools": []},
        {"key": "refund", "name": "Refund", "role": "refunds", "tools": ["read_kb"]},
        {"key": "faq", "name": "FAQ", "role": "answers", "tools": ["read_kb"]},
    ],
    "nodes": [
        {"id": "start", "type": "start"},
        {"id": "triage", "type": "agent", "agent": "triage"},
        {"id": "route", "type": "condition", "prompt": "refund or info?",
         "branches": ["refund", "info"], "default": "info"},
        {"id": "refund", "type": "agent", "agent": "refund"},
        {"id": "faq", "type": "agent", "agent": "faq"},
        {"id": "end", "type": "end"},
    ],
    "edges": [
        {"source": "start", "target": "triage"},
        {"source": "triage", "target": "route"},
        {"source": "route", "target": "refund", "when": "refund"},
        {"source": "route", "target": "faq", "when": "info"},
        {"source": "refund", "target": "end"},
        {"source": "faq", "target": "end"},
    ],
}


@pytest.mark.asyncio
async def test_spec_to_graph_json_maps_agents_and_conditions():
    keymap = {"triage": "id-triage", "refund": "id-refund", "faq": "id-faq"}
    g = spec_to_graph_json(SPEC, keymap)

    by_id = {n["id"]: n for n in g["nodes"]}
    # agent nodes carry the resolved agent_id
    assert by_id["triage"]["data"]["agent_id"] == "id-triage"
    assert by_id["refund"]["data"]["agent_id"] == "id-refund"
    # condition node has structured branches + default + llm mode
    cond = by_id["route"]["data"]
    assert cond["mode"] == "llm"
    assert [b["label"] for b in cond["branches"]] == ["refund", "info"]
    assert cond["default"] == "info"
    # conditional edges keep their 'when' label
    refund_edge = next(e for e in g["edges"] if e["source"] == "route" and e["target"] == "refund")
    assert refund_edge["data"]["when"] == "refund"


@pytest.mark.asyncio
async def test_spec_to_graph_json_compiles_with_fake_agents():
    """The generated graph_json validates through the real Compiler."""
    from app.runtime.compiler import validate
    from app.schemas.graph import GraphJSON
    from app.tests.fakes import FakeAgent

    keymap = {"triage": "id-triage", "refund": "id-refund", "faq": "id-faq"}
    g = spec_to_graph_json(SPEC, keymap)
    agents = {v: FakeAgent("X") for v in keymap.values()}
    result = validate(GraphJSON.model_validate(g), agents)
    assert result.ok, [e.message for e in result.errors]
