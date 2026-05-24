"""Run lifecycle: create, list, get, messages, resume."""
from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, Request
from langchain_core.messages import HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_executor
from app.core.errors import AppError, NotFoundError
from app.models import Agent, Message, Workflow, WorkflowRun
from app.runtime.executor import Executor
from app.schemas.run import MessageRead, ResumeRequest, RunCreate, RunRead

router = APIRouter(prefix="/api/runs", tags=["runs"])


async def _resolve_agents(db: AsyncSession, agent_ids: list[uuid.UUID] | None):
    if agent_ids:
        agents = [await db.get(Agent, aid) for aid in agent_ids]
        agents = [a for a in agents if a is not None]
    else:
        agents = (await db.execute(select(Agent).order_by(Agent.created_at).limit(2))).scalars().all()
    if len(agents) < 2:
        raise AppError("need at least 2 agents (researcher, writer) to run the P1 graph",
                       code="insufficient_agents", status_code=422)
    return agents[0], agents[1]


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
    researcher, writer = await _resolve_agents(db, body.agent_ids)
    wf = await db.get(Workflow, body.workflow_id) if body.workflow_id else None
    if wf is None:
        wf = await _demo_workflow(db)

    run = WorkflowRun(workflow_id=wf.id, status="pending")
    db.add(run)
    await db.commit()
    await db.refresh(run)

    initial = {
        "messages": [HumanMessage(content=body.input.message or "")],
        "scratch": dict(body.input.vars or {}),
    }
    _spawn(request, executor.run(run.id, researcher, writer, initial))
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
    researcher, writer = await _resolve_agents(db, None)
    _spawn(request, executor.resume(run_id, researcher, writer, body.value))
    return run
