"""Workflow CRUD + dry-run validation (the builder calls /validate on save)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.core.errors import AppError, NotFoundError
from app.models import Agent, Workflow
from app.runtime.compiler import validate
from app.runtime.generator import explain_workflow, generate_workflow_spec, spec_to_graph_json
from app.runtime.speech import synthesize_speech, transcribe_audio
from app.scheduling import scheduler as sched
from app.schemas.graph import GraphJSON, ValidationResult
from app.schemas.workflow import GenerateRequest, WorkflowCreate, WorkflowRead, WorkflowUpdate

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Workflow).order_by(Workflow.created_at))).scalars().all()


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(body: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    wf = Workflow(**body.model_dump())
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    if wf.schedule_cron:
        sched.schedule_workflow(wf.id, wf.schedule_cron)
    return wf


@router.post("/generate", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def generate_workflow(body: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """Natural-language (or voice-transcribed) request -> agents + a workflow.

    An LLM designs the spec; we create the agents (forced onto the configured
    model so the result actually runs) and assemble the graph.
    """
    try:
        spec = await generate_workflow_spec(body.prompt)
    except Exception as exc:  # noqa: BLE001
        raise AppError(f"could not generate a workflow: {exc}", code="generation_failed", status_code=422)

    keymap: dict[str, str] = {}
    for a in spec.get("agents", []):
        agent = Agent(
            name=a.get("name", "Agent"), role=a.get("role", ""),
            system_prompt=a.get("system_prompt", ""),
            model=settings.llm_model,  # force the working model, ignore any LLM-picked model
            tools=[t for t in (a.get("tools") or [])],
        )
        db.add(agent)
        await db.flush()
        keymap[a.get("key", a.get("name", ""))] = str(agent.id)

    graph_json = spec_to_graph_json(spec, keymap)
    wf = Workflow(
        name=spec.get("name", "Generated workflow"),
        description=spec.get("description", body.prompt[:140]),
        graph_json=graph_json,
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return wf


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Spoken request -> text (ElevenLabs Scribe). The client then POSTs the text
    to /generate, so the user can review the transcript before building."""
    data = await file.read()
    text = await transcribe_audio(data, file.filename or "audio.webm",
                                  file.content_type or "audio/webm")
    return {"text": text}


class SpeakRequest(BaseModel):
    text: str


@router.post("/speak")
async def speak(body: SpeakRequest):
    """Text -> spoken mp3 (ElevenLabs TTS) for the "voice-back" feature."""
    audio = await synthesize_speech(body.text[:5000])
    return Response(content=audio, media_type="audio/mpeg")


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(workflow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise NotFoundError(f"workflow {workflow_id} not found")
    return wf


@router.patch("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(workflow_id: uuid.UUID, body: WorkflowUpdate,
                          db: AsyncSession = Depends(get_db)):
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise NotFoundError(f"workflow {workflow_id} not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(wf, key, value)
    await db.commit()
    await db.refresh(wf)
    if wf.schedule_cron:
        sched.schedule_workflow(wf.id, wf.schedule_cron)
    else:
        sched.unschedule_workflow(wf.id)
    return wf


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(workflow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise NotFoundError(f"workflow {workflow_id} not found")
    await db.delete(wf)
    await db.commit()
    sched.unschedule_workflow(workflow_id)


@router.post("/{workflow_id}/validate", response_model=ValidationResult)
async def validate_workflow(workflow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise NotFoundError(f"workflow {workflow_id} not found")
    graph = GraphJSON.model_validate(wf.graph_json or {})
    agents: dict[str, Agent] = {}
    for n in graph.nodes:
        if n.type in ("agent", "deepagent") and n.data.get("agent_id"):
            aid = str(n.data["agent_id"])
            try:
                agent = await db.get(Agent, uuid.UUID(aid))
            except (ValueError, TypeError):
                agent = None
            if agent:
                agents[aid] = agent
    return validate(graph, agents)


@router.post("/{workflow_id}/explain")
async def explain(workflow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Plain-English summary of what a workflow does (the reverse of /generate)."""
    wf = await db.get(Workflow, workflow_id)
    if wf is None:
        raise NotFoundError(f"workflow {workflow_id} not found")
    graph = wf.graph_json or {}

    # Resolve agent names/roles referenced by nodes so the explanation is concrete.
    resolved: dict[str, dict] = {}
    for n in graph.get("nodes", []):
        aid = (n.get("data") or {}).get("agent_id")
        if not aid or str(aid) in resolved:
            continue
        try:
            a = await db.get(Agent, uuid.UUID(str(aid)))
        except (ValueError, TypeError):
            a = None
        if a:
            resolved[str(aid)] = {"name": a.name, "role": a.role}

    nodes = []
    for n in graph.get("nodes", []):
        d = n.get("data") or {}
        item: dict = {"id": n.get("id"), "type": n.get("type")}
        aid = d.get("agent_id")
        if aid and str(aid) in resolved:
            item["agent"] = resolved[str(aid)]
        if n.get("type") == "condition":
            item["question"] = d.get("prompt")
            item["branches"] = [b.get("label") for b in (d.get("branches") or [])]
        nodes.append(item)
    edges = [{"from": e.get("source"), "to": e.get("target"),
              "when": (e.get("data") or {}).get("when")} for e in graph.get("edges", [])]

    summary = {"name": wf.name, "description": wf.description, "nodes": nodes, "edges": edges}
    try:
        text = await explain_workflow(summary)
    except Exception as exc:  # noqa: BLE001
        raise AppError(f"could not explain workflow: {exc}", code="explain_failed", status_code=502)
    return {"explanation": text}
