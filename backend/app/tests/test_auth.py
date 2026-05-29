"""The API gate: protected routes require a valid email-login bearer token."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_protected_routes_require_token(monkeypatch):
    # Re-enable the gate for this test (conftest disables it globally).
    monkeypatch.setattr(settings, "auth_enabled", True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        # No token -> 401
        assert (await c.get("/api/agents")).status_code == 401
        # Bad token -> 401
        assert (await c.get("/api/agents", headers={"Authorization": "Bearer garbage"})).status_code == 401
        # login is open and issues a token
        r = await c.post("/api/auth/login", json={"email": "tester@example.com"})
        assert r.status_code == 200
        token = r.json()["token"]
        # Valid token -> allowed (200)
        ok = await c.get("/api/agents", headers={"Authorization": f"Bearer {token}"})
        assert ok.status_code == 200
