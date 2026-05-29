"""Console access — demo-grade, email-only.

The user enters an email to enter the console; we record it (one row per unique
email) and return a signed token the SPA stores. There is no password: this is a
public demo gate, not real authentication. The landing page stays unauthenticated.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.errors import AppError
from app.core.logging import get_logger
from app.models import ConsoleUser

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = get_logger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginRequest(BaseModel):
    email: str


class LoginResponse(BaseModel):
    token: str
    user: str


def _issue_token(user: str) -> str:
    sig = hmac.new(settings.auth_password.encode(), user.encode(), hashlib.sha256).hexdigest()[:24]
    return base64.urlsafe_b64encode(f"{user}:{sig}".encode()).decode()


def verify_token(token: str | None) -> str | None:
    """Return the email a token was issued to if its HMAC signature is valid, else None."""
    if not token:
        return None
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        user, sig = raw.rsplit(":", 1)
    except Exception:  # noqa: BLE001
        return None
    expected = hmac.new(settings.auth_password.encode(), user.encode(), hashlib.sha256).hexdigest()[:24]
    return user if hmac.compare_digest(sig, expected) else None


async def _record_email(email: str) -> None:
    """Save the email once (ignore if it already signed in before)."""
    async with SessionLocal() as s:
        exists = (await s.execute(
            select(ConsoleUser).where(ConsoleUser.email == email))).scalars().first()
        if exists:
            return
        s.add(ConsoleUser(email=email))
        try:
            await s.commit()
        except IntegrityError:  # raced with a concurrent first sign-in
            await s.rollback()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise AppError("please enter a valid email address", code="invalid_email", status_code=400)
    await _record_email(email)
    log.info("console.login", email=email)
    return LoginResponse(token=_issue_token(email), user=email)
