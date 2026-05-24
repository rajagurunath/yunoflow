"""Console authentication — gates the web console behind credentials.

Demo-grade: a single operator account from settings (AUTH_USERNAME/AUTH_PASSWORD).
The password is verified server-side and a signed token is returned; the SPA
stores it and only renders the console when present. The public landing page is
unauthenticated.
"""
from __future__ import annotations

import base64
import hashlib
import hmac

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import AppError

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: str


def _issue_token(user: str) -> str:
    sig = hmac.new(settings.auth_password.encode(), user.encode(), hashlib.sha256).hexdigest()[:24]
    return base64.urlsafe_b64encode(f"{user}:{sig}".encode()).decode()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    ok = hmac.compare_digest(body.username, settings.auth_username) and hmac.compare_digest(
        body.password, settings.auth_password
    )
    if not ok:
        raise AppError("invalid username or password", code="invalid_credentials", status_code=401)
    return LoginResponse(token=_issue_token(body.username), user=body.username)
