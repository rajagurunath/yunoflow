"""LLM client factory — OpenAI-compatible, configured from settings.

A single seam so the whole app talks to any OpenAI-compatible endpoint
(io.net Intelligence / OpenAI / OpenRouter / local) via env, and so tests
can swap in a deterministic fake by monkeypatching ``build_chat_model``.
"""
from __future__ import annotations

from typing import Any

from app.core.config import settings


def build_chat_model(
    model: str | None = None,
    temperature: float = 0.7,
    top_p: float = 1.0,
    **kwargs: Any,
):
    """Return a ChatOpenAI bound to the configured OpenAI-compatible endpoint.

    Imported lazily so that importing this module (e.g. at app startup or in
    tests that monkeypatch it) does not hard-require langchain-openai.
    """
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model or settings.llm_model,
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key or "not-set",
        temperature=temperature,
        top_p=top_p,
        stream_usage=True,
        **kwargs,
    )
