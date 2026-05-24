"""Run lifecycle: create, list, get, messages, resume.

The graph is built per run via the builder (compiled from the workflow's
graph_json, or the P1 fixed fallback when the workflow has no nodes).
"""
from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, Request
from langchain_core.messages import HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_executor
from app.core.errors import NotFoundError
from app.models import Message, Usage, Workflow, WorkflowRun
from app.runtime.builder import build_graph_for_workflow
from app.runtime.executor import Executor
from app.schemas.run import (
    MessageRead, ResumeRequest, RunCreate, RunRead, UsageRead, UsageSummary,
)
from app.tools.guardrails import budget_for, recursion_limit_for

router = APIRouter(prefix="/api/runs", tags=["runs"])


async def _demo_workflow(db: AsyncSession) -> Workflow:
    wf = (await db.execute(select(Workflow).where(Workflow.name == "Fixed Demo (P1)"))).scalars().first()
    if wf is None:
        wf = Workflow(name="Fixed Demo (P1)", description="P1 researcher->writer graph", graph_json={})
        db.add(wf)
        await db.commit()
        await db.refresh(wf)
    return wf


def _spawn(request: Request, coro) -> None:
    task = asyncio.create_task(coro)
    request.app.state.tasks.add(task)
    task.add_done_callback(request.app.state.tasks.discard)


@router.post("", response_model=RunRead)
async def create_run(body: RunCreate, request: Request,
                     db: AsyncSession = Depends(get_db),
                     executor: Executor = Depends(get_executor)):
    wf = await db.get(Workflow, body.workflow_id) if body.workflow_id else None
    if wf is None:
        wf = await _demo_workflow(db)

    graph, agents = await build_graph_for_workflow(db, wf, executor.cp, agent_ids=body.agent_ids)
    rlimit = recursion_limit_for(agents)
    max_tokens, max_cost = budget_for(agents)

    run = WorkflowRun(workflow_id=wf.id, status="pending")
    db.add(run)
    await db.commit()
    await db.refresh(run)

    initial = {
        "messages": [HumanMessage(content=body.input.message or "")],
        "scratch": dict(body.input.vars or {}),
    }
    _spawn(request, executor.run(run.id, graph, initial,
                                 recursion_limit=rlimit, max_tokens=max_tokens, max_cost=max_cost))
    return run


@router.get("", response_model=list[RunRead])
async def list_runs(db: AsyncSession = Depends(get_db),
                    workflow_id: uuid.UUID | None = None, status: str | None = None):
    stmt = select(WorkflowRun).order_by(WorkflowRun.created_at.desc())
    if workflow_id:
        stmt = stmt.where(WorkflowRun.workflow_id == workflow_id)
    if status:
        stmt = stmt.where(WorkflowRun.status == status)
    return (await db.execute(stmt)).scalars().all()


@router.get("/{run_id}", response_model=RunRead)
async def get_run(run_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    run = await db.get(WorkflowRun, run_id)
    if run is None:
        raise NotFoundError(f"run {run_id} not found")
    return run


@router.get("/{run_id}/messages", response_model=list[MessageRead])
async def get_run_messages(run_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                           channel: str | None = None):
    stmt = select(Message).where(Message.run_id == run_id).order_by(Message.created_at)
    if channel:
        stmt = stmt.where(Message.channel == channel)
    return (await db.execute(stmt)).scalars().all()


@router.get("/{run_id}/usage", response_model=UsageSummary)
async def get_run_usage(run_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Usage).where(Usage.run_id == run_id).order_by(Usage.created_at))).scalars().all()
    return UsageSummary(
        items=[UsageRead.model_validate(r) for r in rows],
        total_tokens=sum(r.total_tokens for r in rows),
        total_cost_usd=round(sum(r.cost_usd for r in rows), 6),
    )


@router.get("/{run_id}/events")
async def get_run_events(run_id: uuid.UUID, request: Request) -> list[dict]:
    """Persisted monitor events (the WebSocket replays these on connect)."""
    return await request.app.state.event_bus.history(run_id)


@router.post("/{run_id}/resume", response_model=RunRead)
async def resume_run(run_id: uuid.UUID, body: ResumeRequest, request: Request,
                     db: AsyncSession = Depends(get_db),
                     executor: Executor = Depends(get_executor)):
    run = await db.get(WorkflowRun, run_id)
    if run is None:
        raise NotFoundError(f"run {run_id} not found")
    wf = await db.get(Workflow, run.workflow_id)
    graph, agents = await build_graph_for_workflow(db, wf, executor.cp)
    rlimit = recursion_limit_for(agents)
    max_tokens, max_cost = budget_for(agents)
    _spawn(request, executor.resume(run_id, graph, body.value,
                                    recursion_limit=rlimit, max_tokens=max_tokens, max_cost=max_cost))
    return run
