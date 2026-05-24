"""APScheduler wiring for agent `schedule_cron`.

Registers a cron job per scheduled agent. P3 fires a log + creates a run of the
agent's demo workflow; richer binding-driven triggers come later. In-memory
jobstore (fine for local; a Postgres jobstore would persist across restarts).
"""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.logging import get_logger

log = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def start() -> None:
    s = get_scheduler()
    if not s.running:
        s.start()
        log.info("scheduler.started")


def shutdown() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


def schedule_agent(agent_id, cron: str) -> bool:
    if not cron:
        return False
    try:
        get_scheduler().add_job(
            _fire, CronTrigger.from_crontab(cron),
            id=f"agent:{agent_id}", replace_existing=True, args=[str(agent_id)],
        )
        log.info("schedule.registered", agent=str(agent_id), cron=cron)
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("schedule.invalid", agent=str(agent_id), cron=cron, error=str(exc))
        return False


def unschedule_agent(agent_id) -> None:
    try:
        get_scheduler().remove_job(f"agent:{agent_id}")
    except Exception:  # noqa: BLE001
        pass


async def _fire(agent_id: str) -> None:
    log.info("schedule.fired", agent=agent_id)
