"""Routes inbound channel messages to the runtime (start or resume a run).

P1/P2 binding logic is intentionally simple: a demo workflow + resume the
latest waiting run for the same chat. P3 adds proper ChannelBinding resolution.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable

from langchain_core.messages import HumanMessage
from sqlalchemy import or_, select

from app.channels.base import InboundMessage
from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.models import Message, Workflow, WorkflowRun
from app.runtime.builder import build_graph_for_workflow
from app.runtime.executor import Executor

log = get_logger(__name__)

SendFn = Callable[[str, str], Awaitable[None]]


async def _noop_send(external_chat_id: str, text: str) -> None:
    log.info("reply.noop", chat=external_chat_id, text=text[:120])


class ChannelRouter:
    def __init__(self, executor: Executor, send: SendFn | None = None, session_factory=SessionLocal):
        self.executor = executor
        self.send: SendFn = send or _noop_send
        self.sf = session_factory

    async def _demo_workflow(self, s) -> Workflow:
        wf = (await s.execute(select(Workflow).where(Workflow.name == "Fixed Demo (P1)"))).scalars().first()
        if wf is None:
            wf = Workflow(name="Fixed Demo (P1)", description="P1 researcher->writer graph", graph_json={})
            s.add(wf)
            await s.commit()
            await s.refresh(wf)
        return wf

    async def _resolve_workflow(self, s, channel_type: str, external_chat_id: str) -> Workflow:
        """A ChannelBinding (for this chat, or a channel-wide default) selects the
        workflow; otherwise fall back to the demo graph."""
        from app.models import ChannelBinding

        stmt = (
            select(ChannelBinding)
            .where(
                ChannelBinding.channel_type == channel_type,
                ChannelBinding.active.is_(True),
                ChannelBinding.workflow_id.isnot(None),
                or_(ChannelBinding.external_chat_id == external_chat_id,
                    ChannelBinding.external_chat_id.is_(None)),
            )
            # prefer a chat-specific binding over a channel-wide default
            .order_by(ChannelBinding.external_chat_id.is_(None).asc())
            .limit(1)
        )
        binding = (await s.execute(stmt)).scalars().first()
        if binding and binding.workflow_id:
            wf = await s.get(Workflow, binding.workflow_id)
            if wf is not None:
                return wf
        return await self._demo_workflow(s)

    async def _capture_chat(self, s, channel_type: str, external_chat_id: str,
                            workflow_id) -> None:
        """Remember this chat on the workflow's binding so console/scheduled runs
        can push approval prompts here. Set once; never overwrites a chosen id."""
        from app.models import ChannelBinding

        if workflow_id is None:
            return
        rows = (await s.execute(
            select(ChannelBinding)
            .where(ChannelBinding.channel_type == channel_type,
                   ChannelBinding.active.is_(True),
                   ChannelBinding.workflow_id == workflow_id)
            .order_by(ChannelBinding.created_at.desc())
        )).scalars().all()
        # Never capture into an approval binding — that chat belongs to the approver.
        binding = next((b for b in rows if (b.config_json or {}).get("role") != "approval"), None)
        if binding is None or (binding.config_json or {}).get("notify_chat_id"):
            return
        binding.config_json = {**(binding.config_json or {}), "notify_chat_id": str(external_chat_id)}
        await s.commit()

    async def _latest_waiting_for_chat(self, s, external_chat_id: str,
                                       workflow_id=None) -> WorkflowRun | None:
        stmt = (
            select(WorkflowRun)
            .join(Message, Message.run_id == WorkflowRun.id)
            .where(WorkflowRun.status == "waiting_human", Message.external_chat_id == external_chat_id)
        )
        # A dedicated bot only resumes runs of its own workflow, so two bots
        # talking to the same Telegram user can't cross-wire their conversations.
        if workflow_id is not None:
            stmt = stmt.where(WorkflowRun.workflow_id == workflow_id)
        stmt = stmt.order_by(WorkflowRun.created_at.desc()).limit(1)
        return (await s.execute(stmt)).scalars().first()

    async def _latest_waiting_for_workflow(self, s, workflow_id) -> WorkflowRun | None:
        """The approval bot resumes by workflow (the run was started by a customer
        on a different chat), so match on the workflow, not the approver's chat."""
        if workflow_id is None:
            return None
        stmt = (select(WorkflowRun)
                .where(WorkflowRun.status == "waiting_human",
                       WorkflowRun.workflow_id == workflow_id)
                .order_by(WorkflowRun.created_at.desc()).limit(1))
        return (await s.execute(stmt)).scalars().first()

    async def _customer_chat_for_run(self, s, run_id) -> str | None:
        """The chat that started a run (so the final answer goes back to the customer)."""
        stmt = (select(Message.external_chat_id)
                .where(Message.run_id == run_id, Message.role == "user",
                       Message.external_chat_id.isnot(None))
                .order_by(Message.created_at.asc()).limit(1))
        return (await s.execute(stmt)).scalars().first()

    async def _approval_binding(self, s, workflow_id):
        """The approval-role binding for a workflow (carries the approver bot token)."""
        from app.models import ChannelBinding

        rows = (await s.execute(
            select(ChannelBinding).where(ChannelBinding.channel_type == "telegram",
                                         ChannelBinding.active.is_(True),
                                         ChannelBinding.workflow_id == workflow_id)
        )).scalars().all()
        return next((b for b in rows if (b.config_json or {}).get("role") == "approval"), None)

    @staticmethod
    def _sender_for(token: str) -> SendFn:
        from app.channels.telegram import TelegramChannel

        ch = TelegramChannel(token)
        return ch.send

    async def _register_approver(self, s, binding, chat_id: str) -> None:
        binding.config_json = {**(binding.config_json or {}), "notify_chat_id": str(chat_id)}
        await s.commit()

    async def handle_inbound(self, m: InboundMessage, send: SendFn | None = None,
                             workflow_id=None, role: str = "customer") -> None:
        """Route one inbound message.

        role="customer" (default): start the bound workflow; the approval prompt
        is sent to the workflow's approval bot (if any), the final answer back here.
        role="approval": this is the approver's bot — register their chat on first
        contact, otherwise resume the workflow's waiting run with their reply.
        """
        send_fn = send or self.send

        if role == "approval":
            await self._handle_approval(m, send_fn, workflow_id)
            return

        async def reply(text: str) -> None:
            await send_fn(m.external_chat_id, text)

        on_interrupt = None
        async with self.sf() as s:
            waiting = await self._latest_waiting_for_chat(s, m.external_chat_id, workflow_id)
            if waiting is not None:
                wf = await s.get(Workflow, waiting.workflow_id)
                graph, _ = await build_graph_for_workflow(s, wf, self.executor.cp)
                wf_id = waiting.workflow_id
            else:
                if workflow_id is not None:
                    wf = await s.get(Workflow, workflow_id) or await self._demo_workflow(s)
                else:
                    wf = await self._resolve_workflow(s, m.channel_type, m.external_chat_id)
                graph, _ = await build_graph_for_workflow(s, wf, self.executor.cp)
                wf_id = wf.id
                await self._capture_chat(s, m.channel_type, m.external_chat_id, wf_id)
            # If an approver is configured for this workflow, route approvals there.
            appr = await self._approval_binding(s, wf_id)
            appr_chat = (appr.config_json or {}).get("notify_chat_id") if appr else None
            appr_token = (appr.config_json or {}).get("bot_token") if appr else None

        if appr and appr_chat and appr_token:
            appr_send = self._sender_for(appr_token)

            async def on_interrupt(text: str) -> None:  # noqa: F811
                await appr_send(appr_chat, text)

        if waiting is not None:
            await self._persist_inbound(waiting.id, m)
            await self.executor.resume(waiting.id, graph, m.text,
                                       on_reply=reply, on_interrupt=on_interrupt)
            return

        async with self.sf() as s:
            run = WorkflowRun(workflow_id=wf_id, status="pending")
            s.add(run)
            await s.commit()
            await s.refresh(run)
            run_id = run.id

        await self._persist_inbound(run_id, m)
        await self.executor.run(
            run_id, graph,
            {"messages": [HumanMessage(content=m.text)], "scratch": {}},
            on_reply=reply, on_interrupt=on_interrupt,
        )

    async def _handle_approval(self, m: InboundMessage, send_fn: SendFn, workflow_id) -> None:
        """The approver's bot: register on first contact, else resume the waiting run."""
        async with self.sf() as s:
            waiting = await self._latest_waiting_for_workflow(s, workflow_id)
            if waiting is None:
                appr = await self._approval_binding(s, workflow_id)
                if appr is not None:
                    await self._register_approver(s, appr, m.external_chat_id)
                await send_fn(m.external_chat_id,
                              "✅ You're the approver for this workflow. Approval requests "
                              "will arrive here — reply 'ok' to approve, or send instructions.")
                return
            wf = await s.get(Workflow, waiting.workflow_id)
            graph, _ = await build_graph_for_workflow(s, wf, self.executor.cp)
            customer_chat = await self._customer_chat_for_run(s, waiting.id)
            run_id = waiting.id

        await self._persist_inbound(run_id, m)

        async def to_customer(text: str) -> None:
            if customer_chat:
                await self.send(customer_chat, text)   # final answer -> customer (default bot)

        async def to_approver(text: str) -> None:
            await send_fn(m.external_chat_id, text)     # further prompts -> this approver

        await self.executor.resume(run_id, graph, m.text,
                                   on_reply=to_customer, on_interrupt=to_approver)

    async def _persist_inbound(self, run_id, m: InboundMessage) -> None:
        async with self.sf() as s:
            s.add(Message(run_id=run_id, role="user", content=m.text,
                          channel=m.channel_type, external_chat_id=m.external_chat_id))
            await s.commit()
