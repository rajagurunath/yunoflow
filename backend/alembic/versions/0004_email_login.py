"""P7: email-only console login — capture demo sign-in emails

Revision ID: 0004_email_login
Revises: 0003_p6_scheduling
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_email_login"
down_revision = "0003_p6_scheduling"
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "console_users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_console_users_email", "console_users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_console_users_email", table_name="console_users")
    op.drop_table("console_users")
