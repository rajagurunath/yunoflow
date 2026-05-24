"""Deterministic fakes for tests (no network, no real LLM)."""
from __future__ import annotations

from langchain_core.messages import AIMessage


class FakeChatModel:
    """Minimal stand-in for ChatOpenAI — only needs ``ainvoke``.

    Echoes a marker from the system prompt so tests can assert which agent ran
    (useful for verifying conditional routing).
    """

    def __init__(self, reply: str = "draft answer", **_kwargs):
        self._reply = reply

    async def ainvoke(self, messages, **_kwargs):
        system = ""
        for m in messages:
            if getattr(m, "type", "") == "system":
                system = str(m.content)
                break
        content = f"{system} :: {self._reply}" if system else self._reply
        return AIMessage(
            content=content,
            usage_metadata={"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            response_metadata={"model_name": "gpt-4o-mini"},
        )


def fake_build_chat_model(model=None, temperature=0.7, top_p=1.0, **_kwargs):
    return FakeChatModel(reply="draft answer")


class FakeAgent:
    """Lightweight Agent stand-in for compiler tests (no DB needed)."""

    def __init__(self, system_prompt: str, model: str = "gpt-4o-mini",
                 temperature: float = 0.0, top_p: float = 1.0, role: str = "agent"):
        self.system_prompt = system_prompt
        self.model = model
        self.temperature = temperature
        self.top_p = top_p
        self.role = role
