"""Platform metrics summary — powers the console's impact-metrics tile."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models import Agent, Message, Workflow, WorkflowRun

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

# The 14 configurable dimensions exposed per agent (Agent Studio).
AGENT_DIMENSIONS = 14


@router.get("/summary")
async def summary(db: AsyncSession = Depends(get_db)) -> dict:
    async def count(stmt) -> int:
        return int((await db.execute(stmt)).scalar_one() or 0)

    # run counts by status
    rows = (await db.execute(
        select(WorkflowRun.status, func.count()).group_by(WorkflowRun.status))).all()
    by_status = {s: int(c) for s, c in rows}
    completed = by_status.get("completed", 0)
    failed = by_status.get("failed", 0)
    waiting = by_status.get("waiting_human", 0)
    running = by_status.get("running", 0) + by_status.get("pending", 0)
    total = sum(by_status.values())
    terminal = completed + failed
    completion_rate = round(completed / terminal, 4) if terminal else None

    tokens = await count(select(func.coalesce(func.sum(WorkflowRun.total_tokens), 0)))
    cost = float((await db.execute(
        select(func.coalesce(func.sum(WorkflowRun.total_cost_usd), 0.0)))).scalar_one() or 0.0)

    messages_total = await count(select(func.count()).select_from(Message))
    agent_messages = await count(
        select(func.count()).select_from(Message).where(Message.role == "assistant"))

    agents_count = await count(select(func.count()).select_from(Agent))
    workflows_count = await count(select(func.count()).select_from(Workflow))
    scheduled = (
        await count(select(func.count()).select_from(Workflow).where(Workflow.schedule_cron.isnot(None)))
        + await count(select(func.count()).select_from(Agent).where(Agent.schedule_cron.isnot(None)))
    )

    # avg end-to-end seconds for completed runs (DB-agnostic, computed in Python)
    comp = (await db.execute(
        select(WorkflowRun.started_at, WorkflowRun.ended_at).where(
            WorkflowRun.status == "completed",
            WorkflowRun.started_at.isnot(None), WorkflowRun.ended_at.isnot(None)))).all()
    durs = [(e - s).total_seconds() for s, e in comp if e and s]
    avg_run_seconds = round(sum(durs) / len(durs), 1) if durs else None

    return {
        "agent_dimensions": AGENT_DIMENSIONS,
        "agents": agents_count,
        "workflows": workflows_count,
        "scheduled": scheduled,
        "runs_total": total,
        "runs_completed": completed,
        "runs_failed": failed,
        "runs_waiting": waiting,
        "runs_running": running,
        "completion_rate": completion_rate,   # completed / (completed+failed)
        "avg_run_seconds": avg_run_seconds,
        "tokens_total": tokens,
        "cost_total": round(cost, 4),
        "messages_total": messages_total,
        "agent_messages": agent_messages,     # agent-to-agent (assistant) messages
    }
