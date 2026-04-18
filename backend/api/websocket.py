from fastapi import WebSocket, WebSocketDisconnect
from fastapi import APIRouter
import asyncio
import json
import time
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

router = APIRouter(tags=["websocket"])

# ─── Connection Manager ───────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected! Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected! Total: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        """Send data to all connected clients"""
        message = json.dumps(data)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.active_connections.remove(conn)

manager = ConnectionManager()

# ─── Global references ────────────────────────────────────────
_phase_manager = None
_signal_timer  = None

def set_ws_controllers(pm, timer):
    global _phase_manager, _signal_timer
    _phase_manager = pm
    _signal_timer  = timer

# ─── WebSocket endpoint ───────────────────────────────────────
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Send live signal data every second
            if _phase_manager:
                data = {
                    "type":       "signal_update",
                    "timestamp":  time.time(),
                    "states":     _phase_manager.get_states(),
                    "green_lane": _phase_manager.current_green_lane,
                    "is_manual":  _phase_manager.is_manual,
                    "time_remaining": _signal_timer.time_remaining
                        if _signal_timer else 0
                }
                await websocket.send_text(json.dumps(data))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ─── Broadcast helper — call from anywhere ───────────────────
async def broadcast_signal_update(data: dict):
    await manager.broadcast(data)