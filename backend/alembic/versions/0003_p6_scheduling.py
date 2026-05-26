"""P6: workflow scheduling + nullable run.workflow_id (single-agent scheduled runs)

Revision ID: 0003_p6_scheduling
Revises: 0002_p4_run_events
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_p6_scheduling"
down_revision = "0002_p4_run_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("workflows", sa.Column("schedule_cron", sa.String(120), nullable=True))
    # A scheduled *agent* run isn't tied to a workflow, so allow NULL.
    op.alter_column("workflow_runs", "workflow_id", existing_type=sa.Uuid(), nullable=True)


def downgrade() -> None:
    op.alter_column("workflow_runs", "workflow_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_column("workflows", "schedule_cron")
