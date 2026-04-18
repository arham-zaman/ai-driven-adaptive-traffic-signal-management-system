from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import API_HOST, API_PORT, CORS_ORIGINS
from backend.database.db import init_db
from backend.signal_controller.phase_manager import PhaseManager
from backend.signal_controller.timer import SignalTimer

# ─── Import routers ───────────────────────────────────────────
from backend.api.routes.predictions import router as predictions_router
from backend.api.routes.signals import router as signals_router, set_phase_manager
from backend.api.routes.logs import router as logs_router
from backend.api.routes.manual_control import router as control_router, set_controllers
from backend.api.websocket import router as ws_router, set_ws_controllers

# ─── App ──────────────────────────────────────────────────────
app = FastAPI(
    title="AI Traffic Signal Management System",
    description="Adaptive traffic signal control using LSTM/GRU",
    version="1.0.0"
)

# ─── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global instances ─────────────────────────────────────────
phase_manager = PhaseManager()
signal_timer  = SignalTimer(phase_manager)

# ─── Inject into routers ──────────────────────────────────────
set_phase_manager(phase_manager)
set_controllers(phase_manager, signal_timer)
set_ws_controllers(phase_manager, signal_timer)

# ─── Include routers ──────────────────────────────────────────
app.include_router(predictions_router)
app.include_router(signals_router)
app.include_router(logs_router)
app.include_router(control_router)
app.include_router(ws_router)

# ─── Startup ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()
    print("Database ready!")
    print("All routes loaded!")
    print("API started!")

# ─── Root ─────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "AI Traffic Signal API is running!",
        "version": "1.0.0",
        "routes": [
            "/predictions",
            "/signals",
            "/logs",
            "/control",
            "/ws"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app",
                host=API_HOST,
                port=API_PORT,
                reload=True)