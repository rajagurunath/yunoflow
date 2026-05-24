"""Starts/stops configured channels for the app lifespan."""
from __future__ import annotations

from app.channels.telegram import TelegramChannel
from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


class ChannelManager:
    def __init__(self):
        self.channels: list = []

    async def start_all(self, router) -> None:
        if settings.telegram_bot_token:
            ch = TelegramChannel(settings.telegram_bot_token)
            try:
                await ch.start(router.handle_inbound)
                router.send = ch.send  # outbound replies now go through Telegram
                self.channels.append(ch)
            except Exception as exc:  # noqa: BLE001
                log.warning("channel.start_failed", channel="telegram", error=str(exc))
        else:
            log.info("channel.telegram_disabled", reason="no token")

    async def stop_all(self) -> None:
        for ch in self.channels:
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
        return out
