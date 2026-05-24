"""Routes inbound channel messages to the runtime (start or resume a run).

P1 binding logic is intentionally simple: pick the two most-recent agents and a
demo workflow, and resume the latest waiting run for the same chat. P3 replaces
this with proper ChannelBinding resolution.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable

from langchain_core.messages import HumanMessage
from sqlalchemy import select

from app.channels.base import InboundMessage
from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.models import Agent, Message, Workflow, WorkflowRun
from app.runtime.executor import Executor

log = get_logger(__name__)

SendFn = Callable[[str, str], Awaitable[None]]


async def _noop_send(external_chat_id: str, text: str) -> None:  # default until a channel binds
    log.info("reply.noop", chat=external_chat_id, text=text[:120])


class ChannelRouter:
    def __init__(self, executor: Executor, send: SendFn | None = None, session_factory=SessionLocal):
        self.executor = executor
        self.send: SendFn = send or _noop_send
        self.sf = session_factory

    async def _two_agents(self, s):
        rows = (await s.execute(select(Agent).order_by(Agent.created_at).limit(2))).scalars().all()
        if len(rows) < 2:
            raise RuntimeError("channel routing needs at least 2 agents")
        return rows[0], rows[1]

    async def _demo_workflow(self, s) -> Workflow:
        wf = (await s.execute(select(Workflow).where(Workflow.name == "Fixed Demo (P1)"))).scalars().first()
        if wf is None:
            wf = Workflow(name="Fixed Demo (P1)", description="P1 researcher->writer graph", graph_json={})
            s.add(wf)
            await s.commit()
            await s.refresh(wf)
        return wf

    async def _latest_waiting_for_chat(self, s, external_chat_id: str) -> WorkflowRun | None:
        # Find the most recent run that produced a message for this chat and is waiting.
        stmt = (
            select(WorkflowRun)
            .join(Message, Message.run_id == WorkflowRun.id)
            .where(WorkflowRun.status == "waiting_human", Message.external_chat_id == external_chat_id)
            .order_by(WorkflowRun.created_at.desc())
            .limit(1)
        )
        return (await s.execute(stmt)).scalars().first()

    async def handle_inbound(self, m: InboundMessage) -> None:
        async def reply(text: str) -> None:
            await self.send(m.external_chat_id, text)

        async with self.sf() as s:
            researcher, writer = await self._two_agents(s)
            wf = await self._demo_workflow(s)
            waiting = await self._latest_waiting_for_chat(s, m.external_chat_id)

        if waiting is not None:
            await self._persist_inbound(waiting.id, m)
            await self.executor.resume(waiting.id, researcher, writer, m.text, on_reply=reply)
            return

        async with self.sf() as s:
            run = WorkflowRun(workflow_id=wf.id, status="pending")
            s.add(run)
            await s.commit()
            await s.refresh(run)
            run_id = run.id

        await self._persist_inbound(run_id, m)
        await self.executor.run(
            run_id, researcher, writer,
            {"messages": [HumanMessage(content=m.text)], "scratch": {}},
            on_reply=reply,
        )

    async def _persist_inbound(self, run_id, m: InboundMessage) -> None:
        async with self.sf() as s:
            s.add(Message(run_id=run_id, role="user", content=m.text,
                          channel=m.channel_type, external_chat_id=m.external_chat_id))
            await s.commit()
