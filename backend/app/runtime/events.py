"""In-process event bus: persists run events (for replay) and fans them out to
WebSocket subscribers (for live monitoring). Single-process design (local-first);
the AG-UI-shaped boundary we'd standardize for multi-process.
"""
from __future__ import annotations

import asyncio
import datetime as dt

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import RunEvent


def _envelope(run_id, seq, type_, data, ts) -> dict:
    return {"seq": seq, "run_id": str(run_id), "type": type_, "data": data or {},
            "ts": (ts or dt.datetime.now(dt.timezone.utc)).isoformat()}


class EventBus:
    def __init__(self, session_factory=SessionLocal):
        self.sf = session_factory
        self._subs: dict[str, set[asyncio.Queue]] = {}

    async def emit(self, run_id, type_: str, data: dict | None = None) -> dict:
        async with self.sf() as s:
            cur = (await s.execute(
                select(func.max(RunEvent.seq)).where(RunEvent.run_id == run_id))).scalar() or 0
            seq = cur + 1
            row = RunEvent(run_id=run_id, seq=seq, type=type_, data=data or {})
            s.add(row)
            await s.commit()
            await s.refresh(row)
            ts = row.created_at
        env = _envelope(run_id, seq, type_, data, ts)
        for q in list(self._subs.get(str(run_id), ())):
            q.put_nowait(env)
        return env

    async def history(self, run_id) -> list[dict]:
        async with self.sf() as s:
            rows = (await s.execute(
                select(RunEvent).where(RunEvent.run_id == run_id).order_by(RunEvent.seq))).scalars().all()
        return [_envelope(r.run_id, r.seq, r.type, r.data, r.created_at) for r in rows]

    def subscribe(self, run_id) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.setdefault(str(run_id), set()).add(q)
        return q

    def unsubscribe(self, run_id, q: asyncio.Queue) -> None:
        subs = self._subs.get(str(run_id))
        if subs:
            subs.discard(q)
            if not subs:
                self._subs.pop(str(run_id), None)
