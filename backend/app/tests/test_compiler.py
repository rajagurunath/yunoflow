"""P2 gate: the Compiler — linear, conditional routing, cycles, validation."""
from __future__ import annotations

import uuid

import pytest
from langchain_core.messages import HumanMessage

from app.runtime.compiler import compile_graph, validate
from app.schemas.graph import GraphJSON
from app.tests.fakes import FakeAgent


def _cfg():
    return {"configurable": {"thread_id": str(uuid.uuid4())}}


def _contents(state) -> str:
    return " ".join(str(getattr(m, "content", "")) for m in state["messages"])


@pytest.mark.asyncio
async def test_linear_graph(checkpointer):
    agents = {"a": FakeAgent("ALPHA"), "b": FakeAgent("BETA")}
    g = GraphJSON.model_validate({
        "nodes": [
            {"id": "s", "type": "start"},
            {"id": "a", "type": "agent", "data": {"agent_id": "a"}},
            {"id": "b", "type": "agent", "data": {"agent_id": "b"}},
            {"id": "e", "type": "end"},
        ],
        "edges": [
            {"id": "1", "source": "s", "target": "a"},
            {"id": "2", "source": "a", "target": "b"},
            {"id": "3", "source": "b", "target": "e"},
        ],
    })
    graph = compile_graph(g, agents=agents, checkpointer=checkpointer)
    out = await graph.ainvoke({"messages": [HumanMessage("hi")], "scratch": {}}, _cfg())
    text = _contents(out)
    assert "ALPHA" in text and "BETA" in text


@pytest.mark.asyncio
@pytest.mark.parametrize("intent,marker,absent", [("refund", "REFUND", "INFOAGENT"),
                                                  ("info", "INFOAGENT", "REFUND")])
async def test_conditional_routing(checkpointer, intent, marker, absent):
    agents = {"r": FakeAgent("REFUND"), "i": FakeAgent("INFOAGENT")}
    g = GraphJSON.model_validate({
        "nodes": [
            {"id": "s", "type": "start"},
            {"id": "route", "type": "condition",
             "data": {"mode": "value", "key": "intent",
                      "branches": [{"label": "refund"}, {"label": "info"}], "default": "info"}},
            {"id": "r", "type": "agent", "data": {"agent_id": "r"}},
            {"id": "i", "type": "agent", "data": {"agent_id": "i"}},
            {"id": "e", "type": "end"},
        ],
        "edges": [
            {"id": "1", "source": "s", "target": "route"},
            {"id": "2", "source": "route", "target": "r", "data": {"when": "refund"}},
            {"id": "3", "source": "route", "target": "i", "data": {"when": "info"}},
            {"id": "4", "source": "r", "target": "e"},
            {"id": "5", "source": "i", "target": "e"},
        ],
    })
    graph = compile_graph(g, agents=agents, checkpointer=checkpointer)
    out = await graph.ainvoke({"messages": [HumanMessage("q")], "scratch": {"intent": intent}}, _cfg())
    text = _contents(out)
    assert out.get("route") == intent
    assert marker in text
    assert absent not in text  # the other branch did not run


@pytest.mark.asyncio
async def test_cycle_feedback_loop(checkpointer):
    agents = {"w": FakeAgent("WORK")}
    g = GraphJSON.model_validate({
        "nodes": [
            {"id": "s", "type": "start"},
            {"id": "w", "type": "agent", "data": {"agent_id": "w"}},
            {"id": "gate", "type": "condition",
             "data": {"mode": "expr", "expr": "'loop' if len(messages) < 4 else 'done'",
                      "branches": [{"label": "loop"}, {"label": "done"}], "default": "done"}},
            {"id": "e", "type": "end"},
        ],
        "edges": [
            {"id": "1", "source": "s", "target": "w"},
            {"id": "2", "source": "w", "target": "gate"},
            {"id": "3", "source": "gate", "target": "w", "data": {"when": "loop"}},
            {"id": "4", "source": "gate", "target": "e", "data": {"when": "done"}},
        ],
    })
    graph = compile_graph(g, agents=agents, checkpointer=checkpointer)
    out = await graph.ainvoke({"messages": [HumanMessage("go")], "scratch": {}}, _cfg())
    assert out.get("route") == "done"
    ai_msgs = [m for m in out["messages"] if getattr(m, "type", "") == "ai"]
    assert len(ai_msgs) >= 3  # looped several times before terminating


@pytest.mark.asyncio
async def test_deepagent_node_compiles(checkpointer):
    # Structural: the deepagent node compiles (create_deep_agent runs at invoke time).
    agents = {"d": FakeAgent("INVESTIGATE")}
    g = GraphJSON.model_validate({
        "nodes": [
            {"id": "s", "type": "start"},
            {"id": "d", "type": "deepagent", "data": {"agent_id": "d"}},
            {"id": "e", "type": "end"},
        ],
        "edges": [{"id": "1", "source": "s", "target": "d"}, {"id": "2", "source": "d", "target": "e"}],
    })
    graph = compile_graph(g, agents=agents, checkpointer=checkpointer)
    assert graph is not None


@pytest.mark.asyncio
async def test_validate_missing_start():
    g = GraphJSON.model_validate({
        "nodes": [{"id": "a", "type": "agent", "data": {"agent_id": "a"}}, {"id": "e", "type": "end"}],
        "edges": [],
    })
    result = validate(g, {"a": FakeAgent("X")})
    assert not result.ok
    assert any("start" in i.message for i in result.errors)


@pytest.mark.asyncio
async def test_validate_unknown_agent():
    g = GraphJSON.model_validate({
        "nodes": [
            {"id": "s", "type": "start"},
            {"id": "a", "type": "agent", "data": {"agent_id": "missing"}},
            {"id": "e", "type": "end"},
        ],
        "edges": [{"id": "1", "source": "s", "target": "a"}, {"id": "2", "source": "a", "target": "e"}],
    })
    result = validate(g, {})
    assert not result.ok
    assert any("agent_id" in i.message for i in result.errors)


@pytest.mark.asyncio
async def test_validate_dangling_edge_and_branch_mismatch():
    dangling = GraphJSON.model_validate({
        "nodes": [{"id": "s", "type": "start"}, {"id": "e", "type": "end"}],
        "edges": [{"id": "1", "source": "s", "target": "ghost"}],
    })
    r1 = validate(dangling, {})
    assert not r1.ok and any("not found" in i.message for i in r1.errors)

    mismatch = GraphJSON.model_validate({
        "nodes": [
            {"id": "s", "type": "start"},
            {"id": "c", "type": "condition",
             "data": {"branches": [{"label": "x"}, {"label": "y"}], "default": "x"}},
            {"id": "a", "type": "agent", "data": {"agent_id": "a"}},
            {"id": "e", "type": "end"},
        ],
        "edges": [
            {"id": "1", "source": "s", "target": "c"},
            {"id": "2", "source": "c", "target": "a", "data": {"when": "z"}},
            {"id": "3", "source": "a", "target": "e"},
        ],
    })
    r2 = validate(mismatch, {"a": FakeAgent("X")})
    assert not r2.ok and any("not a declared branch" in i.message for i in r2.errors)
