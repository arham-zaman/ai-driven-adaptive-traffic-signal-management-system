from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import API_HOST, API_PORT, CORS_ORIGINS
from backend.database.db import init_db
from backend.signal_controller.phase_manager import PhaseManager
from backend.signal_controller.timer import SignalTimer

# ─── Init ─────────────────────────────────────────────────────
app = FastAPI(
    title="AI Traffic Signal Management System",
    description="Adaptive traffic signal control using LSTM/GRU",
    version="1.0.0"
)

# ─── CORS — allow React frontend ──────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global instances ─────────────────────────────────────────
phase_manager = PhaseManager()
signal_timer  = SignalTimer(phase_manager)

# ─── Startup ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()
    print("Database ready!")
    print("API started!")

# ─── Routes ───────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "AI Traffic Signal API is running!",
        "version": "1.0.0"
    }

@app.get("/status")
def get_status():
    """Get current signal states and timer status"""
    return signal_timer.get_status()

@app.get("/signals")
def get_signals():
    """Get current signal state for all lanes"""
    return {
        "states":     phase_manager.get_states(),
        "green_lane": phase_manager.current_green_lane,
        "is_manual":  phase_manager.is_manual
    }

@app.post("/signals/next")
def next_phase(north: int = 0, south: int = 0,
               east: int = 0, west: int = 0):
    """Trigger next phase with vehicle counts"""
    lane_counts = {
        "north": north,
        "south": south,
        "east":  east,
        "west":  west
    }
    phase = phase_manager.next_phase(lane_counts)
    return phase

@app.post("/signals/manual/{lane}")
def manual_override(lane: str, green_time: float = 30):
    """Manually set a lane to green"""
    try:
        phase = phase_manager.manual_override(lane, green_time)
        return {"success": True, "phase": phase}
    except ValueError as e:
        return {"success": False, "error": str(e)}

@app.post("/signals/release")
def release_manual():
    """Release manual control"""
    phase_manager.release_manual()
    return {"success": True, "message": "Back to adaptive mode"}

@app.post("/signals/emergency")
def emergency_stop():
    """Emergency — all signals RED"""
    states = phase_manager.emergency_all_red()
    return {"success": True, "states": states}

@app.post("/timer/start")
def start_timer(north: int = 5, south: int = 5,
                east: int = 5, west: int = 5):
    """Start adaptive signal timer"""
    lane_counts = {
        "north": north, "south": south,
        "east": east,   "west": west
    }
    signal_timer.start(lane_counts)
    return {"success": True, "message": "Timer started!"}

@app.post("/timer/stop")
def stop_timer():
    """Stop signal timer"""
    signal_timer.stop()
    return {"success": True, "message": "Timer stopped!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app",
                host=API_HOST,
                port=API_PORT,
                reload=True)