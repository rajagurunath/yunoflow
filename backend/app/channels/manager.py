"""Starts/stops channels for the app lifespan.

Two kinds of Telegram bot run side by side:
  * the shared **default** bot (TELEGRAM_BOT_TOKEN) — routes by ChannelBinding,
    falling back to the demo workflow;
  * any number of **dedicated** bots, one per ChannelBinding that carries its
    own `bot_token` in config_json — each always runs its bound workflow and
    replies through itself. These can be added/removed at runtime via the API.
"""
from __future__ import annotations

from app.channels.telegram import TelegramChannel
from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


class ChannelManager:
    def __init__(self):
        self.channels: list = []          # shared default bot(s)
        self.bots: dict[str, TelegramChannel] = {}  # binding_id -> dedicated bot
        self.router = None

    async def start_all(self, router) -> None:
        self.router = router

        # Shared default bot from the environment.
        if settings.telegram_bot_token:
            ch = TelegramChannel(settings.telegram_bot_token)
            try:
                await ch.start(router.handle_inbound)
                router.send = ch.send  # default outbound replies go through Telegram
                self.channels.append(ch)
            except Exception as exc:  # noqa: BLE001
                log.warning("channel.start_failed", channel="telegram", error=str(exc))
        else:
            log.info("channel.telegram_disabled", reason="no token")

        # Restore dedicated bots persisted from previous sessions.
        from sqlalchemy import select

        from app.core.db import SessionLocal
        from app.models import ChannelBinding

        async with SessionLocal() as s:
            rows = (await s.execute(
                select(ChannelBinding).where(ChannelBinding.active.is_(True))
            )).scalars().all()
        for b in rows:
            if (b.config_json or {}).get("bot_token"):
                try:
                    await self.add_telegram_bot(b)
                except Exception as exc:  # noqa: BLE001
                    log.warning("channel.bot_restore_failed", binding=str(b.id), error=str(exc))

    async def add_telegram_bot(self, binding) -> dict:
        """Start a dedicated bot for `binding` (idempotent on binding id)."""
        bid = str(binding.id)
        await self.remove_telegram_bot(bid)

        token = (binding.config_json or {}).get("bot_token")
        if not token:
            raise ValueError("binding has no bot_token")
        wf_id = binding.workflow_id
        ch = TelegramChannel(token)

        async def handler(m):
            await self.router.handle_inbound(m, send=ch.send, workflow_id=wf_id)

        await ch.start(handler)
        self.bots[bid] = ch
        log.info("channel.bot_started", binding=bid)
        return await ch.status()

    async def remove_telegram_bot(self, binding_id: str) -> None:
        ch = self.bots.pop(str(binding_id), None)
        if ch is not None:
            try:
                await ch.stop()
            except Exception:  # noqa: BLE001
                pass
            log.info("channel.bot_stopped", binding=str(binding_id))

    async def stop_all(self) -> None:
        for ch in [*self.channels, *self.bots.values()]:
            try:
                await ch.stop()
            except Exception:  # noqa: BLE001
                pass

    async def status(self) -> dict:
        out: dict = {}
        for ch in self.channels:
            out[ch.channel_type] = await ch.status()
        if "telegram" not in out:
            out["telegram"] = {"running": False}

        bindings: dict = {}
        for bid, ch in self.bots.items():
            try:
                bindings[bid] = await ch.status()
            except Exception:  # noqa: BLE001
                bindings[bid] = {"running": False}
        out["bindings"] = bindings
        return out
