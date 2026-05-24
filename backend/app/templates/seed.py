"""Seed the 3 prebuilt workflow templates (idempotent).

Agent nodes carry an `agent_spec` (not an agent_id). Instantiating a template
creates real Agents from those specs and rewrites the graph with their ids.

Run: `python -m app.templates.seed`  (or `make seed`).
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.logging import configure_logging, get_logger
from app.models import Template

log = get_logger(__name__)
M = settings.llm_model


def _agent(node_id, name, role, system_prompt, tools=None):
    return {"id": node_id, "type": "agent",
            "data": {"agent_spec": {"name": name, "role": role, "system_prompt": system_prompt,
                                    "model": M, "tools": tools or []}}}


def _payments_support_triage() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            _agent("triage", "Triage", "payments support triage",
                   "You triage payments support requests. Read the customer's message."),
            {"id": "route", "type": "condition",
             "data": {"mode": "llm", "prompt": "Is the customer asking for a refund or general info?",
                      "branches": [{"label": "refund"}, {"label": "info"}], "default": "info"}},
            _agent("refund", "Refund Specialist", "handles refunds",
                   "You resolve refund requests empathetically. Use the knowledge base and the "
                   "AP2 payment tools to create and execute refunds when appropriate.",
                   tools=["read_kb", "create_payment_intent", "create_cart_mandate", "execute_payment"]),
            _agent("faq", "FAQ Agent", "answers general questions",
                   "You answer general payment questions using the knowledge base.",
                   tools=["read_kb"]),
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "triage"},
            {"id": "e2", "source": "triage", "target": "route"},
            {"id": "e3", "source": "route", "target": "refund", "data": {"when": "refund"}},
            {"id": "e4", "source": "route", "target": "faq", "data": {"when": "info"}},
            {"id": "e5", "source": "refund", "target": "end"},
            {"id": "e6", "source": "faq", "target": "end"},
        ],
    }


def _research_draft_review() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            _agent("researcher", "Researcher", "gathers facts",
                   "You research the request and list concise key facts.", tools=["read_kb"]),
            _agent("writer", "Writer", "drafts the answer",
                   "You write a clear, well-structured answer from the research."),
            {"id": "critic", "type": "condition",
             "data": {"mode": "llm", "prompt": "Is the draft good enough to send? Reply approved or revise.",
                      "branches": [{"label": "approved"}, {"label": "revise"}], "default": "approved"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "researcher"},
            {"id": "e2", "source": "researcher", "target": "writer"},
            {"id": "e3", "source": "writer", "target": "critic"},
            {"id": "e4", "source": "critic", "target": "writer", "data": {"when": "revise"}},
            {"id": "e5", "source": "critic", "target": "end", "data": {"when": "approved"}},
        ],
    }


def _payment_authorization() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            _agent("intake", "Intake", "captures the payment request",
                   "You capture the payment request details (amount, currency, merchant)."),
            {"id": "risk", "type": "condition",
             "data": {"mode": "llm", "prompt": "Assess risk: reply approve, stepup, or decline.",
                      "branches": [{"label": "approve"}, {"label": "stepup"}, {"label": "decline"}],
                      "default": "stepup"}},
            _agent("payment", "Payment Agent", "executes the payment",
                   "You execute the payment using the AP2 intent/cart/payment mandate tools.",
                   tools=["create_payment_intent", "create_cart_mandate", "execute_payment"]),
            _agent("stepup", "Step-up", "requests confirmation",
                   "You ask the customer to confirm a higher-risk payment before proceeding."),
            _agent("declined", "Declined", "explains the decline",
                   "You politely explain that the payment was declined and suggest next steps."),
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "intake"},
            {"id": "e2", "source": "intake", "target": "risk"},
            {"id": "e3", "source": "risk", "target": "payment", "data": {"when": "approve"}},
            {"id": "e4", "source": "risk", "target": "stepup", "data": {"when": "stepup"}},
            {"id": "e5", "source": "risk", "target": "declined", "data": {"when": "decline"}},
            {"id": "e6", "source": "payment", "target": "end"},
            {"id": "e7", "source": "stepup", "target": "end"},
            {"id": "e8", "source": "declined", "target": "end"},
        ],
    }


def _dispute_investigator() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "investigator", "type": "deepagent",
             "data": {"agent_spec": {
                 "name": "Dispute Investigator", "role": "investigates payment disputes",
                 "system_prompt": (
                     "You are a payment dispute investigator. Plan your investigation, use the "
                     "knowledge base and payment tools to gather evidence about the disputed "
                     "charge, then give a clear recommendation (refund / deny / escalate) with reasoning."
                 ),
                 "model": M, "tools": ["read_kb", "create_payment_intent", "execute_payment"]}}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "investigator"},
            {"id": "e2", "source": "investigator", "target": "end"},
        ],
    }


TEMPLATES = [
    ("Payments Support Triage",
     "Triage a customer message, route refund vs info, resolve with AP2 refund tools.",
     _payments_support_triage()),
    ("Research → Draft → Review",
     "Researcher drafts, a critic loops back until the draft is approved (feedback loop).",
     _research_draft_review()),
    ("Payment Authorization (AP2)",
     "Risk-assess a payment then approve / step-up / decline using AP2-style mandates.",
     _payment_authorization()),
    ("Dispute Investigator (DeepAgent)",
     "A deep agent that plans, uses tools, and spawns sub-agents to investigate a payment dispute.",
     _dispute_investigator()),
]


async def seed() -> int:
    created = 0
    async with SessionLocal() as s:
        for name, description, graph in TEMPLATES:
            exists = (await s.execute(select(Template).where(Template.name == name))).scalars().first()
            if exists:
                exists.description = description
                exists.graph_json = graph  # keep idempotent + up to date
            else:
                s.add(Template(name=name, description=description, graph_json=graph, seed=True))
                created += 1
        await s.commit()
    log.info("templates.seeded", created=created, total=len(TEMPLATES))
    return created


if __name__ == "__main__":
    configure_logging()
    asyncio.run(seed())
