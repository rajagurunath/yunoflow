"""Critical path: workflow execution + interrupt/resume."""
from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Message, Usage, WorkflowRun
from app.runtime.compiler import compile_graph
from app.runtime.fixed_graph import build_fixed_graph
from app.schemas.graph import GraphJSON
from app.tests.fakes import fake_build_chat_model


@pytest.mark.asyncio
async def test_workflow_execution(executor, two_agents, make_run):
    researcher, writer = two_agents
    run_id = await make_run()
    graph = build_fixed_graph(researcher, writer, executor.cp)

    status = await executor.run(
        run_id, graph,
        {"messages": [HumanMessage(content="hello")], "scratch": {}},
    )
    assert status == "completed"

    async with SessionLocal() as s:
        msgs = (await s.execute(select(Message).where(Message.run_id == run_id))).scalars().all()
        usage = (await s.execute(select(Usage).where(Usage.run_id == run_id))).scalars().all()
        run = await s.get(WorkflowRun, run_id)

    assistant_msgs = [m for m in msgs if m.role == "assistant"]
    assert len(assistant_msgs) >= 2          # researcher + writer
    assert all(m.node_id for m in assistant_msgs)
    assert usage, "expected usage rows persisted"
    assert run.status == "completed"
    assert run.total_tokens > 0
    assert run.ended_at is not None


@pytest.mark.asyncio
async def test_interrupt_then_resume(executor, two_agents, make_run):
    researcher, writer = two_agents
    run_id = await make_run()
    graph = build_fixed_graph(researcher, writer, executor.cp)

    status = await executor.run(
        run_id, graph,
        {"messages": [HumanMessage(content="refund please")], "scratch": {"require_approval": True}},
    )
    assert status == "waiting_human"

    async with SessionLocal() as s:
        run = await s.get(WorkflowRun, run_id)
    assert run.status == "waiting_human"

    status2 = await executor.resume(run_id, graph, "ok proceed")
    assert status2 == "completed"

    async with SessionLocal() as s:
        run = await s.get(WorkflowRun, run_id)
    assert run.status == "completed"


@pytest.mark.asyncio
async def test_human_node_interrupts_then_resumes(executor, two_agents, make_run):
    """A compiled graph with a `human` node pauses at it and resumes on reply."""
    agent, _ = two_agents
    run_id = await make_run()
    graph_def = GraphJSON.model_validate({
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "agent", "type": "agent", "data": {"agent_id": str(agent.id)}},
            {"id": "approval", "type": "human", "data": {"prompt": "Approve to continue?"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "agent"},
            {"id": "e2", "source": "agent", "target": "approval"},
            {"id": "e3", "source": "approval", "target": "end"},
        ],
    })
    graph = compile_graph(graph_def, agents={str(agent.id): agent}, checkpointer=executor.cp,
                          llm_factory=fake_build_chat_model)

    status = await executor.run(run_id, graph,
                                {"messages": [HumanMessage(content="please refund")], "scratch": {}})
    assert status == "waiting_human"

    async with SessionLocal() as s:
        run = await s.get(WorkflowRun, run_id)
    assert run.status == "waiting_human"

    status2 = await executor.resume(run_id, graph, "ok")
    assert status2 == "completed"

    async with SessionLocal() as s:
        msgs = (await s.execute(select(Message).where(Message.run_id == run_id))).scalars().all()
    # The human's reply was threaded into shared state as a [human] turn.
    assert any(m.content.startswith("[human]") for m in msgs if m.role == "user")
