"""Test fixtures: deterministic LLM, clean DB, in-memory executor, sample data."""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.core import llm
from app.core.config import settings
from app.core.db import SessionLocal
from app.models import Agent, Workflow, WorkflowRun
from app.runtime.checkpointer import in_memory_checkpointer
from app.runtime.executor import Executor
from app.tests.fakes import fake_build_chat_model

_TRUNCATE = (
    'TRUNCATE TABLE messages, "usage", workflow_runs, channel_bindings, '
    "workflows, agents RESTART IDENTITY CASCADE"
)


@pytest.fixture(autouse=True)
def _patch_llm(monkeypatch):
    monkeypatch.setattr(llm, "build_chat_model", fake_build_chat_model)


@pytest_asyncio.fixture(autouse=True)
async def _clean_db():
    async with SessionLocal() as s:
        await s.execute(text(_TRUNCATE))
        await s.commit()
    yield


@pytest.fixture
def checkpointer():
    return in_memory_checkpointer()


@pytest.fixture
def executor(checkpointer):
    return Executor(checkpointer)


@pytest_asyncio.fixture
async def two_agents(_clean_db):
    async with SessionLocal() as s:
        # Use the configured model so leftover fixture data still runs against
        # the LLM endpoint (tests share the app DB; the fake LLM ignores this).
        researcher = Agent(name="Researcher", role="researches the question",
                           system_prompt="Research the request.", model=settings.llm_model)
        writer = Agent(name="Writer", role="writes the final answer",
                       system_prompt="Write the final answer.", model=settings.llm_model)
        s.add_all([researcher, writer])
        await s.commit()
        await s.refresh(researcher)
        await s.refresh(writer)
        return researcher, writer


@pytest_asyncio.fixture
async def demo_workflow(_clean_db):
    async with SessionLocal() as s:
        wf = Workflow(name="Fixed Demo (P1)", graph_json={})
        s.add(wf)
        await s.commit()
        await s.refresh(wf)
        return wf


@pytest_asyncio.fixture
async def make_run(demo_workflow):
    async def _make():
        async with SessionLocal() as s:
            run = WorkflowRun(workflow_id=demo_workflow.id, status="pending")
            s.add(run)
            await s.commit()
            await s.refresh(run)
            return run.id

    return _make
