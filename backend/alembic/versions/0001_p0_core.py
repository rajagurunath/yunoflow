"""P0 core schema: agents, workflows, runs, messages, channel_bindings, templates, usage

Revision ID: 0001_p0_core
Revises:
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_p0_core"
down_revision = None
branch_labels = None
depends_on = None

JSONB = postgresql.JSONB()
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(500), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("top_p", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("tools", JSONB, nullable=False, server_default="[]"),
        sa.Column("channels", JSONB, nullable=False, server_default="[]"),
        sa.Column("schedule_cron", sa.String(120), nullable=True),
        sa.Column("memory", JSONB, nullable=False,
                  server_default='{"mode":"window","window_size":10,"summarize":false}'),
        sa.Column("skills", JSONB, nullable=False, server_default="[]"),
        sa.Column("interaction_rules", sa.Text(), nullable=False, server_default=""),
        sa.Column("guardrails", JSONB, nullable=False,
                  server_default='{"max_steps":12,"max_tokens":20000,"max_cost_usd":0.5,"allowed_tools":[]}'),
        sa.Column("personality", JSONB, nullable=False,
                  server_default='{"tone":"professional","traits":[]}'),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "workflows",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("graph_json", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "templates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("graph_json", JSONB, nullable=False, server_default="{}"),
        sa.Column("seed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "channel_bindings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agent_id", sa.Uuid(), nullable=True),
        sa.Column("workflow_id", sa.Uuid(), nullable=True),
        sa.Column("channel_type", sa.String(32), nullable=False),
        sa.Column("config_json", JSONB, nullable=False, server_default="{}"),
        sa.Column("external_chat_id", sa.String(120), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_channel_bindings_external_chat_id", "channel_bindings", ["external_chat_id"])

    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workflow_id", sa.Uuid(),
                  sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("started_at", TS, nullable=True),
        sa.Column("ended_at", TS, nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_workflow_runs_status", "workflow_runs", ["status"])

    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(),
                  sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_agent_id", sa.Uuid(), nullable=True),
        sa.Column("recipient_agent_id", sa.Uuid(), nullable=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("channel", sa.String(32), nullable=False, server_default="internal"),
        sa.Column("external_chat_id", sa.String(120), nullable=True),
        sa.Column("node_id", sa.String(120), nullable=True),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_messages_run_id", "messages", ["run_id"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])

    op.create_table(
        "usage",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(),
                  sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("node_id", sa.String(120), nullable=True),
        sa.Column("model", sa.String(120), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_usage_run_id", "usage", ["run_id"])


def downgrade() -> None:
    op.drop_table("usage")
    op.drop_table("messages")
    op.drop_table("workflow_runs")
    op.drop_index("ix_channel_bindings_external_chat_id", table_name="channel_bindings")
    op.drop_table("channel_bindings")
    op.drop_table("templates")
    op.drop_table("workflows")
    op.drop_table("agents")
