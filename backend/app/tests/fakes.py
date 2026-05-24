"""Deterministic fakes for tests (no network, no real LLM)."""
from __future__ import annotations

from langchain_core.messages import AIMessage


class FakeChatModel:
    """Minimal stand-in for ChatOpenAI — only needs ``ainvoke``."""

    def __init__(self, reply: str = "draft answer", **_kwargs):
        self._reply = reply

    async def ainvoke(self, _messages, **_kwargs):
        return AIMessage(
            content=self._reply,
            usage_metadata={"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            response_metadata={"model_name": "gpt-4o-mini"},
        )


def fake_build_chat_model(model=None, temperature=0.7, top_p=1.0, **_kwargs):
    return FakeChatModel(reply="draft answer")
