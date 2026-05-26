"""Scheduling: a fired job launches a real run; jobs register/unregister."""
from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage

from app.core.db import SessionLocal
from app.models import WorkflowRun
from app.runtime.builder import build_single_agent_graph
from app.scheduling import scheduler as sched


@pytest.mark.asyncio
async def test_fire_invokes_launcher():
    calls: list[tuple[str, str]] = []

    async def fake(kind: str, ident: str) -> None:
        calls.append((kind, ident))

    sched.set_launcher(fake)
    try:
        await sched._fire("workflow", "wf-123")
    finally:
        sched.set_launcher(None)
    assert calls == [("workflow", "wf-123")]


@pytest.mark.asyncio
async def test_schedule_workflow_registers_and_removes_job():
    assert sched.schedule_workflow("abc", "*/5 * * * *") is True
    assert sched.get_scheduler().get_job("workflow:abc") is not None
    sched.unschedule_workflow("abc")
    assert sched.get_scheduler().get_job("workflow:abc") is None
    # an invalid cron is rejected, not raised
    assert sched.schedule_workflow("bad", "not a cron") is False


@pytest.mark.asyncio
async def test_single_agent_scheduled_run_executes(executor, two_agents):
    """A scheduled agent runs on a single-agent graph (no workflow attached)."""
    agent, _ = two_agents
    graph = build_single_agent_graph(agent, executor.cp)
    async with SessionLocal() as s:
        run = WorkflowRun(workflow_id=None, status="pending")
        s.add(run)
        await s.commit()
        await s.refresh(run)
        rid = run.id

    status = await executor.run(rid, graph, {"messages": [HumanMessage(content="hi")], "scratch": {}})
    assert status in ("completed", "waiting_human")

    async with SessionLocal() as s:
        got = await s.get(WorkflowRun, rid)
    assert got.workflow_id is None  # agent run isn't tied to a workflow
    assert got.status in ("completed", "waiting_human", "failed")
