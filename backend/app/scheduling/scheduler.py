"""APScheduler wiring for cron-scheduled agents and workflows.

Each scheduled agent/workflow registers a cron job. When it fires, the job calls
the injected *launcher* (set at app startup) which creates and executes a real
run — an agent runs a single-agent graph; a workflow runs its own graph.

In-memory jobstore (fine for local; the DB is the source of truth — startup
re-registers every scheduled agent/workflow, so jobs survive restarts).
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.logging import get_logger

log = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None
# launcher(kind, id) -> creates + runs a run. kind is "agent" | "workflow".
_launcher: Callable[[str, str], Awaitable[None]] | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def set_launcher(fn: Callable[[str, str], Awaitable[None]]) -> None:
    global _launcher
    _launcher = fn


def start() -> None:
    s = get_scheduler()
    if not s.running:
        s.start()
        log.info("scheduler.started")


def shutdown() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


def _register(kind: str, ident, cron: str) -> bool:
    if not cron:
        return False
    try:
        get_scheduler().add_job(
            _fire, CronTrigger.from_crontab(cron),
            id=f"{kind}:{ident}", replace_existing=True, args=[kind, str(ident)],
        )
        log.info("schedule.registered", kind=kind, id=str(ident), cron=cron)
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("schedule.invalid", kind=kind, id=str(ident), cron=cron, error=str(exc))
        return False


def _remove(kind: str, ident) -> None:
    try:
        get_scheduler().remove_job(f"{kind}:{ident}")
    except Exception:  # noqa: BLE001
        pass


def schedule_agent(agent_id, cron: str) -> bool:
    return _register("agent", agent_id, cron)


def unschedule_agent(agent_id) -> None:
    _remove("agent", agent_id)


def schedule_workflow(workflow_id, cron: str) -> bool:
    return _register("workflow", workflow_id, cron)


def unschedule_workflow(workflow_id) -> None:
    _remove("workflow", workflow_id)


async def _fire(kind: str, ident: str) -> None:
    log.info("schedule.fired", kind=kind, id=ident)
    if _launcher is None:
        log.warning("schedule.no_launcher", kind=kind, id=ident)
        return
    try:
        await _launcher(kind, ident)
    except Exception as exc:  # noqa: BLE001
        log.warning("schedule.launch_failed", kind=kind, id=ident, error=str(exc))
