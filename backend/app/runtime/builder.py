"""Builds the runnable graph for a workflow + returns the agents involved.

Compiled from graph_json when it has nodes; otherwise the P1 fixed
researcher->writer fallback. Returns (graph, agents) so callers can derive
guardrail limits.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core import llm
from app.core.errors import AppError
from app.models import Agent
from app.runtime.compiler import compile_graph
from app.runtime.fixed_graph import build_fixed_graph
from app.schemas.graph import GraphJSON
from app.tools import registry


async def build_graph_for_workflow(db, workflow, checkpointer, agent_ids=None):
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
        graph = compile_graph(
            graph_def, agents=agents, checkpointer=checkpointer,
            llm_factory=llm.build_chat_model, tool_resolver=registry.resolve,
            known_tools=set(registry.REGISTRY),
        )
        return graph, list(agents.values())

    # Fixed fallback: use the explicitly requested agents if given, else the two oldest.
    if agent_ids:
        rows = [await db.get(Agent, aid) for aid in agent_ids]
        rows = [a for a in rows if a is not None]
    else:
        rows = list((await db.execute(select(Agent).order_by(Agent.created_at).limit(2))).scalars().all())
    if len(rows) < 2:
        raise AppError("need at least 2 agents to run", code="insufficient_agents", status_code=422)
    return build_fixed_graph(rows[0], rows[1], checkpointer), list(rows)


def build_single_agent_graph(agent, checkpointer):
    """Compile a minimal start → agent → end graph for one agent.

    Used by the scheduler so an agent's `schedule_cron` runs the agent on its own.
    """
    aid = str(agent.id)
    graph_def = GraphJSON.model_validate({
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "agent", "type": "agent", "data": {"agent_id": aid}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "agent"},
            {"id": "e2", "source": "agent", "target": "end"},
        ],
    })
    return compile_graph(
        graph_def, agents={aid: agent}, checkpointer=checkpointer,
        llm_factory=llm.build_chat_model, tool_resolver=registry.resolve,
        known_tools=set(registry.REGISTRY),
    )
