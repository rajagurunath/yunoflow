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
from app.models import Message, Workflow, WorkflowRun
from app.runtime.builder import build_graph_for_workflow
from app.runtime.executor import Executor
from app.schemas.run import MessageRead, ResumeRequest, RunCreate, RunRead

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

    graph = await build_graph_for_workflow(db, wf, executor.cp)

    run = WorkflowRun(workflow_id=wf.id, status="pending")
    db.add(run)
    await db.commit()
    await db.refresh(run)

    initial = {
        "messages": [HumanMessage(content=body.input.message or "")],
        "scratch": dict(body.input.vars or {}),
    }
    _spawn(request, executor.run(run.id, graph, initial))
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


@router.post("/{run_id}/resume", response_model=RunRead)
async def resume_run(run_id: uuid.UUID, body: ResumeRequest, request: Request,
                     db: AsyncSession = Depends(get_db),
                     executor: Executor = Depends(get_executor)):
    run = await db.get(WorkflowRun, run_id)
    if run is None:
        raise NotFoundError(f"run {run_id} not found")
    wf = await db.get(Workflow, run.workflow_id)
    graph = await build_graph_for_workflow(db, wf, executor.cp)
    _spawn(request, executor.resume(run_id, graph, body.value))
    return run
