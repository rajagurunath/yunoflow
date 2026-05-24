"""Critical path: guardrails cut a runaway / over-budget run to 'failed'."""
from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage

from app.core.db import SessionLocal
from app.models import WorkflowRun
from app.runtime.compiler import compile_graph
from app.runtime.fixed_graph import build_fixed_graph
from app.schemas.graph import GraphJSON
from app.tests.fakes import FakeAgent


@pytest.mark.asyncio
async def test_recursion_guardrail(executor, make_run):
    # An always-loop condition -> infinite cycle, capped by recursion_limit.
    agents = {"w": FakeAgent("LOOP")}
    g = GraphJSON.model_validate({
        "nodes": [
            {"id": "s", "type": "start"},
            {"id": "w", "type": "agent", "data": {"agent_id": "w"}},
            {"id": "gate", "type": "condition",
             "data": {"mode": "expr", "expr": "'loop'",
                      "branches": [{"label": "loop"}, {"label": "done"}], "default": "loop"}},
            {"id": "e", "type": "end"},
        ],
        "edges": [
            {"id": "1", "source": "s", "target": "w"},
            {"id": "2", "source": "w", "target": "gate"},
            {"id": "3", "source": "gate", "target": "w", "data": {"when": "loop"}},
            {"id": "4", "source": "gate", "target": "e", "data": {"when": "done"}},
        ],
    })
    graph = compile_graph(g, agents=agents, checkpointer=executor.cp)
    run_id = await make_run()

    status = await executor.run(run_id, graph,
                                {"messages": [HumanMessage("go")], "scratch": {}},
                                recursion_limit=6)
    assert status == "failed"
    async with SessionLocal() as s:
        run = await s.get(WorkflowRun, run_id)
    assert run.status == "failed" and run.error


@pytest.mark.asyncio
async def test_budget_guardrail(executor, two_agents, make_run):
    researcher, writer = two_agents
    graph = build_fixed_graph(researcher, writer, executor.cp)
    run_id = await make_run()

    # Each fake message reports 15 tokens; a 10-token budget trips on the first.
    status = await executor.run(run_id, graph,
                                {"messages": [HumanMessage("hi")], "scratch": {}},
                                max_tokens=10)
    assert status == "failed"
    async with SessionLocal() as s:
        run = await s.get(WorkflowRun, run_id)
    assert run.status == "failed" and run.error == "budget_exceeded"
