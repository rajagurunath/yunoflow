"""Templates: list + instantiate (clone graph, create the referenced agents)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.core.errors import NotFoundError
from app.models import Agent, Template, Workflow
from app.schemas.template import InstantiateRequest, TemplateRead
from app.schemas.workflow import WorkflowRead

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateRead])
async def list_templates(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Template).order_by(Template.created_at))).scalars().all()


@router.post("/{template_id}/instantiate", response_model=WorkflowRead,
             status_code=status.HTTP_201_CREATED)
async def instantiate_template(template_id: uuid.UUID, body: InstantiateRequest,
                               db: AsyncSession = Depends(get_db)):
    template = await db.get(Template, template_id)
    if template is None:
        raise NotFoundError(f"template {template_id} not found")

    graph = {"nodes": [], "edges": list((template.graph_json or {}).get("edges", []))}
    for node in (template.graph_json or {}).get("nodes", []):
        node = dict(node)
        data = dict(node.get("data", {}))
        if node.get("type") in ("agent", "deepagent") and "agent_spec" in data:
            spec = data["agent_spec"]
            agent = Agent(
                name=spec["name"], role=spec.get("role", ""),
                system_prompt=spec.get("system_prompt", ""),
                model=spec.get("model", settings.llm_model),
                tools=spec.get("tools", []), temperature=spec.get("temperature", 0.7),
            )
            db.add(agent)
            await db.flush()  # assign agent.id
            node["data"] = {"agent_id": str(agent.id)}
        graph["nodes"].append(node)

    wf = Workflow(name=body.name or template.name, description=template.description, graph_json=graph)
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return wf
