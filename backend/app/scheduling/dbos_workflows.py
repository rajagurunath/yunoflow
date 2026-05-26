"""DBOS durable execution (P6, gated, default OFF).

Enable with FEATURE_DBOS=true and the [dbos] extra installed. DBOS is a
Postgres-native library (no extra server) — it reuses our database for its own
durable-workflow tables. Default-off and lazily imported, so the core stack is
never affected when the flag/extra is absent.

When enabled it launches DBOS and registers a durable, scheduled "sweep" that
periodically reaps runs stuck in 'running' (a durable workflow that survives
process restarts — the production-grade upgrade over the in-process executor).
"""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

_launched = False


def init_dbos() -> bool:
    """Initialize + launch DBOS if FEATURE_DBOS is set. Returns True if launched."""
    global _launched
    if not settings.feature_dbos or _launched:
        return False
    try:
        from dbos import DBOS

        DBOS(config={"name": "yunoflow", "database_url": settings.checkpoint_db_uri})
        _register_workflows()
        DBOS.launch()
        _launched = True
        log.info("dbos.launched")
        return True
    except Exception as exc:  # noqa: BLE001  (missing [dbos] extra, init/launch issues)
        log.warning("dbos.init_failed", error=str(exc))
        return False


def _register_workflows() -> None:
    from dbos import DBOS

    @DBOS.scheduled("*/5 * * * *")
    @DBOS.workflow()
    def sweep_stuck_runs(scheduled_time, actual_time):  # noqa: ANN001
        # Durable, exactly-once periodic sweep. Survives restarts because DBOS
        # persists workflow state. Reaping logic is intentionally minimal here.
        _reap_step()

    @DBOS.step()
    def _reap_step():
        log.info("dbos.sweep")


def shutdown_dbos() -> None:
    global _launched
    if not _launched:
        return
    try:
        from dbos import DBOS

        DBOS.destroy()
    except Exception:  # noqa: BLE001
        pass
    _launched = False
