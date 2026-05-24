"""Executor: runs/resumes a graph, persists messages + usage, drives status.

P1 uses stream_mode=["updates"] only (deterministic, no token-stream dependency).
P4 adds the "messages" mode for token-level streaming + the WebSocket event bus.
"""
from __future__ import annotations

import datetime as dt

from langchain_core.messages import AIMessage
from langgraph.types import Command
from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.core.pricing import price_for
from app.models import Message, Usage, WorkflowRun

log = get_logger(__name__)

_ROLE = {"ai": "assistant", "human": "user", "system": "system", "tool": "tool"}


def _role_of(msg) -> str:
    return _ROLE.get(getattr(msg, "type", ""), "assistant")


def _interrupt_text(val) -> str:
    if isinstance(val, dict):
        return val.get("question") or str(val)
    return str(val)


def _question_from_state(state) -> str | None:
    for task in getattr(state, "tasks", []) or []:
        for intr in getattr(task, "interrupts", []) or []:
            return _interrupt_text(getattr(intr, "value", intr))
    return None


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Executor:
    def __init__(self, checkpointer, session_factory=SessionLocal):
        self.cp = checkpointer
        self.sf = session_factory

    async def run(self, run_id, graph, initial_input, on_reply=None, *,
                  recursion_limit: int = 25, max_tokens: int | None = None,
                  max_cost: float | None = None) -> str:
        await self._set_status(run_id, "running", started=True)
        return await self._stream(run_id, graph, initial_input, on_reply,
                                  recursion_limit, max_tokens, max_cost)

    async def resume(self, run_id, graph, value, on_reply=None, *,
                     recursion_limit: int = 25, max_tokens: int | None = None,
                     max_cost: float | None = None) -> str:
        await self._set_status(run_id, "running")
        return await self._stream(run_id, graph, Command(resume=value), on_reply,
                                  recursion_limit, max_tokens, max_cost)

    async def _stream(self, run_id, graph, inp, on_reply,
                      recursion_limit=25, max_tokens=None, max_cost=None) -> str:
        cfg = {"configurable": {"thread_id": str(run_id)}, "recursion_limit": recursion_limit}
        final_text: str | None = None
        total_tokens = 0
        total_cost = 0.0
        question: str | None = None
        try:
            async for mode, chunk in graph.astream(inp, cfg, stream_mode=["updates"]):
                if mode != "updates" or not chunk:
                    continue
                for node_id, update in chunk.items():
                    if node_id == "__interrupt__":
                        question = _interrupt_text(update[0].value)
                        continue

                    for msg in (update or {}).get("messages", []) or []:
                        content = getattr(msg, "content", "") or ""
                        usage = getattr(msg, "usage_metadata", None) or {}
                        pt = usage.get("input_tokens", 0)
                        ct = usage.get("output_tokens", 0)
                        tt = usage.get("total_tokens", pt + ct)
                        model_name = (getattr(msg, "response_metadata", {}) or {}).get("model_name")
                        cost = price_for(model_name, pt, ct)
                        if isinstance(msg, AIMessage):
                            await self._persist(run_id, "assistant", content, node_id=node_id,
                                                tokens=tt, cost=cost)
                            if tt:
                                await self._persist_usage(run_id, node_id, model_name, pt, ct, tt, cost)
                            total_tokens += tt
                            total_cost += cost
                            final_text = content
                            if (max_tokens and total_tokens > max_tokens) or (
                                max_cost and total_cost > max_cost
                            ):
                                await self._finalize(run_id, "failed", total_tokens, total_cost,
                                                     error="budget_exceeded")
                                return "failed"
                        else:
                            await self._persist(run_id, _role_of(msg), content, node_id=node_id)

            # Robust pause detection: if the graph still has a next node, it interrupted.
            if question is None:
                state = await graph.aget_state(cfg)
                if getattr(state, "next", None):
                    question = _question_from_state(state) or "Awaiting human input."

            if question is not None:
                await self._persist(run_id, "assistant", question, node_id="interrupt")
                await self._set_status(run_id, "waiting_human")
                if on_reply:
                    await on_reply(question)
                return "waiting_human"

            await self._finalize(run_id, "completed", total_tokens, total_cost)
            if on_reply and final_text:
                await on_reply(final_text)
            return "completed"
        except Exception as exc:  # noqa: BLE001
            # Includes GraphRecursionError (max_steps guardrail). Record + stop;
            # background tasks must not crash the event loop.
            log.error("executor.failed", run_id=str(run_id), error=str(exc))
            await self._finalize(run_id, "failed", total_tokens, total_cost, error=str(exc))
            return "failed"

    # --- persistence helpers (own sessions; executor runs outside request scope) ---

    async def _persist(self, run_id, role, content, *, node_id=None, tokens=0, cost=0.0,
                       sender=None, channel="internal", external_chat_id=None) -> None:
        async with self.sf() as s:
            s.add(Message(run_id=run_id, role=role, content=content, node_id=node_id,
                          tokens=tokens, cost_usd=cost, sender_agent_id=sender,
                          channel=channel, external_chat_id=external_chat_id))
            await s.commit()

    async def _persist_usage(self, run_id, node_id, model, pt, ct, tt, cost) -> None:
        async with self.sf() as s:
            s.add(Usage(run_id=run_id, node_id=node_id, model=model,
                        prompt_tokens=pt, completion_tokens=ct, total_tokens=tt, cost_usd=cost))
            await s.commit()

    async def _set_status(self, run_id, status, *, started=False) -> None:
        async with self.sf() as s:
            run = await s.get(WorkflowRun, run_id)
            if run:
                run.status = status
                if started and not run.started_at:
                    run.started_at = _now()
                await s.commit()

    async def _finalize(self, run_id, status, tokens, cost, *, error=None) -> None:
        async with self.sf() as s:
            run = await s.get(WorkflowRun, run_id)
            if run:
                run.status = status
                run.ended_at = _now()
                run.total_tokens = (run.total_tokens or 0) + tokens
                run.total_cost_usd = round((run.total_cost_usd or 0.0) + cost, 6)
                if error:
                    run.error = error
                await s.commit()
