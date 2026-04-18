from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db, SignalEvent
from backend.config import LANES, MIN_GREEN_TIME, MAX_GREEN_TIME

router = APIRouter(prefix="/control", tags=["control"])

# ─── Global references ────────────────────────────────────────
_phase_manager = None
_signal_timer  = None

def set_controllers(pm, timer):
    global _phase_manager, _signal_timer
    _phase_manager = pm
    _signal_timer  = timer

@router.get("/status")
def get_control_status():
    """Get current control status"""
    if _phase_manager is None:
        return {"error": "Not initialized"}
    return {
        "is_manual":    _phase_manager.is_manual,
        "manual_lane":  _phase_manager.manual_lane,
        "green_lane":   _phase_manager.current_green_lane,
        "states":       _phase_manager.get_states(),
        "timer_running": _signal_timer.running if _signal_timer else False
    }

@router.post("/manual/{lane}")
def manual_override(
    lane: str,
    green_time: float = 30,
    db: Session = Depends(get_db)
):
    """Manually set a lane to green — Control Panel"""
    if _phase_manager is None:
        return {"error": "Not initialized"}
    if lane not in LANES:
        return {"error": f"Invalid lane. Choose: {LANES}"}
    if not (MIN_GREEN_TIME <= green_time <= MAX_GREEN_TIME):
        return {"error": f"Green time must be {MIN_GREEN_TIME}-{MAX_GREEN_TIME}s"}

    phase = _phase_manager.manual_override(lane, green_time)

    # Save to DB
    event = SignalEvent(
        lane=lane,
        signal_state="green",
        duration=green_time,
        is_manual=1
    )
    db.add(event)
    db.commit()

    return {
        "success":    True,
        "message":    f"{lane.upper()} set to GREEN for {green_time}s",
        "phase":      phase
    }

@router.post("/release")
def release_manual(db: Session = Depends(get_db)):
    """Release manual control — back to adaptive AI mode"""
    if _phase_manager is None:
        return {"error": "Not initialized"}

    _phase_manager.release_manual()

    event = SignalEvent(
        lane="all",
        signal_state="adaptive",
        duration=0,
        is_manual=0
    )
    db.add(event)
    db.commit()

    return {
        "success": True,
        "message": "Released — back to AI adaptive mode",
        "states":  _phase_manager.get_states()
    }

@router.post("/emergency")
def emergency_stop(db: Session = Depends(get_db)):
    """Emergency — all signals RED"""
    if _phase_manager is None:
        return {"error": "Not initialized"}

    states = _phase_manager.emergency_all_red()

    event = SignalEvent(
        lane="all",
        signal_state="emergency",
        duration=0,
        is_manual=1
    )
    db.add(event)
    db.commit()

    return {
        "success": True,
        "message": "EMERGENCY — All signals RED!",
        "states":  states
    }

@router.post("/timer/start")
def start_timer(
    north: int = 5, south: int = 5,
    east:  int = 5, west:  int = 5
):
    """Start adaptive signal timer"""
    if _signal_timer is None:
        return {"error": "Timer not initialized"}

    lane_counts = {
        "north": north, "south": south,
        "east":  east,  "west":  west
    }
    _signal_timer.start(lane_counts)
    return {"success": True, "message": "Adaptive timer started!"}

@router.post("/timer/stop")
def stop_timer():
    """Stop signal timer"""
    if _signal_timer is None:
        return {"error": "Timer not initialized"}
    _signal_timer.stop()
    return {"success": True, "message": "Timer stopped!"}