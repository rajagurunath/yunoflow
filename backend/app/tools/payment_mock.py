"""AP2-style mock payment tools (no real rails).

Models the Agent Payments Protocol mandate chain: intent mandate -> cart
mandate -> payment mandate, against an in-memory mock processor. The processor
declines amounts over a threshold so workflows can exercise a step-up branch.
"""
from __future__ import annotations

import uuid

from app.tools.registry import register

DECLINE_THRESHOLD = 1000.0


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


@register("create_payment_intent", side_effecting=True)
def create_payment_intent(amount: float, currency: str, merchant: str, description: str = "") -> dict:
    """AP2 intent mandate: register the user's authorized intent to pay a merchant."""
    return {
        "intent_id": _id("intent"), "amount": amount, "currency": currency,
        "merchant": merchant, "description": description, "status": "intent_created",
    }


@register("create_cart_mandate", side_effecting=True)
def create_cart_mandate(intent_id: str, total: float) -> dict:
    """AP2 cart mandate: bind a concrete cart total to a payment intent."""
    return {"cart_id": _id("cart"), "intent_id": intent_id, "total": total, "status": "cart_created"}


@register("execute_payment", side_effecting=True)
def execute_payment(cart_id: str, payment_method: str, amount: float) -> dict:
    """AP2 payment mandate: execute the payment via the mock processor.

    Declines (requiring step-up) when amount exceeds the threshold.
    """
    status = "declined" if amount > DECLINE_THRESHOLD else "approved"
    return {
        "payment_id": _id("pay"), "cart_id": cart_id, "payment_method": payment_method,
        "amount": amount, "status": status, "receipt_url": f"https://mock.pay/receipt/{_id('r')}",
    }
