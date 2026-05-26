"""Telegram channel via aiogram long-polling (no public webhook needed)."""
from __future__ import annotations

import asyncio

from app.channels.base import Channel, InboundHandler, InboundMessage
from app.core.logging import get_logger

log = get_logger(__name__)


async def validate_token(token: str) -> str:
    """Confirm a bot token works and return its @username (no leading @).

    Raises on an invalid token so the API can reject it before persisting.
    """
    from aiogram import Bot

    bot = Bot(token)
    try:
        me = await bot.get_me()
        return me.username or ""
    finally:
        await bot.session.close()


class TelegramChannel(Channel):
    channel_type = "telegram"

    def __init__(self, token: str):
        self.token = token
        self.bot = None
        self.dp = None
        self._task: asyncio.Task | None = None

    async def start(self, on_inbound: InboundHandler) -> None:
        from aiogram import Bot, Dispatcher
        from aiogram.types import Message as TgMessage

        self.bot = Bot(self.token)
        self.dp = Dispatcher()

        @self.dp.message()
        async def _handler(msg: "TgMessage") -> None:  # noqa: F821
            await on_inbound(
                InboundMessage(
                    channel_type="telegram",
                    external_chat_id=str(msg.chat.id),
                    text=msg.text or "",
                )
            )

        # uvicorn owns signal handlers, so disable aiogram's.
        self._task = asyncio.create_task(self.dp.start_polling(self.bot, handle_signals=False))
        log.info("telegram.started")

    async def stop(self) -> None:
        try:
            if self.dp:
                await self.dp.stop_polling()
        except Exception:  # noqa: BLE001
            pass
        if self._task:
            self._task.cancel()
        if self.bot:
            await self.bot.session.close()

    async def send(self, external_chat_id: str, text: str) -> None:
        if self.bot is None:
            from aiogram import Bot

            self.bot = Bot(self.token)
        await self.bot.send_message(int(external_chat_id), text)

    async def status(self) -> dict:
        if self.bot is None:
            return {"running": False}
        me = await self.bot.get_me()
        return {"running": True, "bot_username": me.username}
