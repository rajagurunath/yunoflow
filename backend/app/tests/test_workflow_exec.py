"""Critical path: workflow execution + interrupt/resume."""
from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Message, Usage, WorkflowRun


@pytest.mark.asyncio
async def test_workflow_execution(executor, two_agents, make_run):
    researcher, writer = two_agents
    run_id = await make_run()

    status = await executor.run(
        run_id, researcher, writer,
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

    status = await executor.run(
        run_id, researcher, writer,
        {"messages": [HumanMessage(content="refund please")], "scratch": {"require_approval": True}},
    )
    assert status == "waiting_human"

    async with SessionLocal() as s:
        run = await s.get(WorkflowRun, run_id)
    assert run.status == "waiting_human"

    status2 = await executor.resume(run_id, researcher, writer, "ok proceed")
    assert status2 == "completed"

    async with SessionLocal() as s:
        run = await s.get(WorkflowRun, run_id)
    assert run.status == "completed"
