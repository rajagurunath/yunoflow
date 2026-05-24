"""WebSocket monitor: replay persisted events then stream live ones.

GET ws://.../api/ws/runs/{run_id} -> a stream of WSEvent envelopes
(seq, run_id, ts, type, data). Read-only; resume happens over REST/Telegram.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["ws"])


@router.websocket("/api/ws/runs/{run_id}")
async def ws_run(websocket: WebSocket, run_id: uuid.UUID):
    await websocket.accept()
    bus = websocket.app.state.event_bus

    # 1) replay history so late/reconnecting clients catch up
    for env in await bus.history(run_id):
        await websocket.send_json(env)

    # 2) subscribe to live events
    queue = bus.subscribe(run_id)
    try:
        while True:
            env = await queue.get()
            await websocket.send_json(env)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001  (client closed mid-send, etc.)
        pass
    finally:
        bus.unsubscribe(run_id, queue)
