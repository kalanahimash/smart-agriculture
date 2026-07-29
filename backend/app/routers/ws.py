import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.data_store import store

router = APIRouter()
log = logging.getLogger("ws")


@router.websocket("/ws/live")
async def live_feed(websocket: WebSocket):
    await websocket.accept()
    queue = store.subscribe()
    try:
        # Send the current snapshot immediately on connect
        for node, reading in store.latest.items():
            await websocket.send_json({"type": "snapshot", "data": reading.model_dump(mode="json")})

        while True:
            payload = await queue.get()
            await websocket.send_json({"type": "update", "data": payload})
    except WebSocketDisconnect:
        log.info("WebSocket client disconnected")
    finally:
        store.unsubscribe(queue)
