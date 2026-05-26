"""Critical path: agent creation round-trips all configurable dimensions."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

FULL_AGENT = {
    "name": "Full Config Agent",
    "role": "exercises every dimension",
    "system_prompt": "You are a thorough agent.",
    "model": settings.llm_model,
    "temperature": 0.3,
    "top_p": 0.9,
    "tools": ["calculator", "read_kb"],
    "channels": ["telegram"],
    "schedule_cron": None,
    "memory": {"mode": "persistent", "window_size": 20, "summarize": True},
    "skills": ["triage", "refunds"],
    "interaction_rules": "Always confirm the order ID first.",
    "guardrails": {"max_steps": 8, "max_tokens": 1000, "max_cost_usd": 0.25,
                   "allowed_tools": ["calculator"]},
    "personality": {"tone": "empathetic", "traits": ["precise", "warm"]},
}


@pytest.mark.asyncio
async def test_agent_crud_roundtrip():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        r = await c.post("/api/agents", json=FULL_AGENT)
        assert r.status_code == 201, r.text
        created = r.json()
        for key, value in FULL_AGENT.items():
            assert created[key] == value, f"{key}: {created[key]!r} != {value!r}"

        agent_id = created["id"]
        got = await c.get(f"/api/agents/{agent_id}")
        assert got.status_code == 200
        body = got.json()
        assert body["memory"]["mode"] == "persistent"
        assert body["guardrails"]["max_steps"] == 8
        assert body["personality"]["traits"] == ["precise", "warm"]

        patched = await c.patch(f"/api/agents/{agent_id}", json={"temperature": 0.95})
        assert patched.status_code == 200 and patched.json()["temperature"] == 0.95

        listing = await c.get("/api/agents")
        assert any(a["id"] == agent_id for a in listing.json())

        deleted = await c.delete(f"/api/agents/{agent_id}")
        assert deleted.status_code == 204
        missing = await c.get(f"/api/agents/{agent_id}")
        assert missing.status_code == 404
