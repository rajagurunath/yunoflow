"""Builds the runnable graph for a workflow: compiled from graph_json, or the
P1 fixed researcher->writer fallback when the workflow has no nodes yet."""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core import llm
from app.core.errors import AppError
from app.models import Agent
from app.runtime.compiler import compile_graph
from app.runtime.fixed_graph import build_fixed_graph
from app.schemas.graph import GraphJSON


def _no_tools(_names):
    return []


async def build_graph_for_workflow(db, workflow, checkpointer):
    graph_json = (workflow.graph_json if workflow else None) or {}
    if graph_json.get("nodes"):
        graph_def = GraphJSON.model_validate(graph_json)
        agents: dict[str, Agent] = {}
        for n in graph_def.nodes:
            if n.type in ("agent", "deepagent") and n.data.get("agent_id"):
                aid = str(n.data["agent_id"])
                try:
                    agent = await db.get(Agent, uuid.UUID(aid))
                except (ValueError, TypeError):
                    agent = None
                if agent:
                    agents[aid] = agent
        return compile_graph(graph_def, agents=agents, checkpointer=checkpointer,
                             llm_factory=llm.build_chat_model, tool_resolver=_no_tools)

    # Fallback: P1 fixed graph from the two oldest agents.
    rows = (await db.execute(select(Agent).order_by(Agent.created_at).limit(2))).scalars().all()
    if len(rows) < 2:
        raise AppError("need at least 2 agents to run", code="insufficient_agents", status_code=422)
    return build_fixed_graph(rows[0], rows[1], checkpointer)
