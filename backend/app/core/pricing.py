"""Token -> cost computation.

Known models use a static per-1k price table; unknown models fall back to the
env-configured LLM_PRICE_IN/OUT (so custom OpenAI-compatible endpoints still
get cost tracking). Tokens are always tracked even when price is unknown.
"""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

# (input_per_1k, output_per_1k) in USD
MODEL_PRICES: dict[str, tuple[float, float]] = {
    "gpt-4o": (0.0025, 0.01),
    "gpt-4o-mini": (0.00015, 0.0006),
    "gpt-4.1": (0.002, 0.008),
    "gpt-4.1-mini": (0.0004, 0.0016),
}


def price_for(model: str | None, prompt_tokens: int, completion_tokens: int) -> float:
    in_p, out_p = MODEL_PRICES.get(model or "", (settings.llm_price_in, settings.llm_price_out))
    if model and model not in MODEL_PRICES:
        log.debug("pricing.fallback", model=model)
    return round(prompt_tokens / 1000 * in_p + completion_tokens / 1000 * out_p, 6)
