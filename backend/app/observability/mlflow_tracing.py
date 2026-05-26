"""MLflow deep tracing (flagged). Complements the in-UI WebSocket monitor.

Enable with FEATURE_MLFLOW=true and the [obs] extra installed. autolog captures
LangGraph/LLM/tool calls as traces in a local MLflow server.
"""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


def setup_mlflow() -> None:
    if not settings.feature_mlflow:
        return
    try:
        import mlflow

        mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
        mlflow.set_experiment("yunoflow")
        mlflow.langchain.autolog(log_traces=True)
        log.info("mlflow.autolog_enabled", uri=settings.mlflow_tracking_uri)
    except Exception as exc:  # noqa: BLE001
        # Most likely: the [obs] extra (mlflow) is not installed, or a
        # langchain/autolog version mismatch. Non-fatal — the UI monitor stands alone.
        log.warning("mlflow.setup_failed", error=str(exc))
