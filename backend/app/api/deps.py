"""Shared FastAPI dependencies."""
from __future__ import annotations

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.auth import verify_token
from app.core.config import settings
from app.core.db import get_db  # re-export for routers
from app.core.errors import AppError
from app.runtime.executor import Executor

__all__ = ["get_db", "get_executor", "require_auth"]


def get_executor(request: Request) -> Executor:
    return request.app.state.executor


_bearer = HTTPBearer(auto_error=False)


async def require_auth(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str | None:
    """Gate a router behind the email-login bearer token.

    Read live so tests can toggle ``settings.auth_enabled``. CORS preflight
    (OPTIONS) is handled by the CORS middleware before this runs, so it is unaffected.
    """
    if not settings.auth_enabled:
        return None
    user = verify_token(creds.credentials if creds else None)
    if user is None:
        raise AppError("authentication required — sign in to get a token",
                       code="unauthorized", status_code=401)
    return user
