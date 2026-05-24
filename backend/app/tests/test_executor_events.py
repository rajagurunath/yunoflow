"""P4 gate: monitor event stream — envelope shapes, seq monotonicity, replay."""
from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage

from app.runtime.events import EventBus
from app.runtime.executor import Executor
from app.runtime.fixed_graph import build_fixed_graph


@pytest.mark.asyncio
async def test_event_stream_and_replay(two_agents, make_run, checkpointer):
    bus = EventBus()
    executor = Executor(checkpointer, bus=bus)
    researcher, writer = two_agents
    run_id = await make_run()
    graph = build_fixed_graph(researcher, writer, checkpointer)

    live_queue = bus.subscribe(run_id)
    status = await executor.run(run_id, graph,
                                {"messages": [HumanMessage("hi")], "scratch": {}})
    assert status == "completed"

    live: list[dict] = []
    while not live_queue.empty():
        live.append(live_queue.get_nowait())

    types = [e["type"] for e in live]
    assert "run_started" in types
    assert "agent_message" in types
    assert "token_usage" in types
    assert "run_completed" in types

    seqs = [e["seq"] for e in live]
    assert seqs == sorted(seqs)              # monotonic
    assert len(set(seqs)) == len(seqs)       # unique

    for e in live:
        assert {"seq", "run_id", "type", "ts", "data"} <= set(e)

    # replay from persistence matches the live stream
    history = await bus.history(run_id)
    assert len(history) == len(live)
    assert [e["type"] for e in history] == types
