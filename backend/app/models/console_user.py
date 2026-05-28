"""ConsoleUser — emails captured at the demo console sign-in (no password).

Demo-grade auth: the user enters an email to enter the console; we record it so
there's a record of who tried the demo. One row per unique email.
"""
from __future__ import annotations

import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ConsoleUser(Base, TimestampMixin):
    __tablename__ = "console_users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
