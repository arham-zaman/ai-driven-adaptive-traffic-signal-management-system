from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db, SignalEvent
from backend.config import LANES

router = APIRouter(prefix="/signals", tags=["signals"])

# ─── Global phase manager reference ───────────────────────────
_phase_manager = None

def set_phase_manager(pm):
    global _phase_manager
    _phase_manager = pm

def get_phase_manager():
    return _phase_manager

@router.get("/")
def get_signals():
    """Get current signal states for all lanes"""
    pm = get_phase_manager()
    if pm is None:
        return {"error": "Phase manager not initialized"}
    return {
        "states":     pm.get_states(),
        "green_lane": pm.current_green_lane,
        "is_manual":  pm.is_manual,
        "phase_index": pm.phase_index
    }

@router.get("/states")
def get_signal_states():
    """Get just the signal states — for dashboard"""
    pm = get_phase_manager()
    if pm is None:
        return {lane: "red" for lane in LANES}
    return pm.get_states()

@router.post("/next")
def next_phase(
    north: int = 0, south: int = 0,
    east: int = 0,  west: int = 0,
    db: Session = Depends(get_db)
):
    """Move to next signal phase"""
    pm = get_phase_manager()
    if pm is None:
        return {"error": "Phase manager not initialized"}

    lane_counts = {
        "north": north, "south": south,
        "east":  east,  "west":  west
    }
    phase = pm.next_phase(lane_counts)

    # Save to DB
    event = SignalEvent(
        lane=phase["green_lane"],
        signal_state="green",
        duration=phase["green_time"],
        is_manual=0
    )
    db.add(event)
    db.commit()

    return phase

@router.get("/history")
def get_signal_history(db: Session = Depends(get_db)):
    """Get recent signal events"""
    events = db.query(SignalEvent).order_by(
        SignalEvent.timestamp.desc()
    ).limit(100).all()

    return [{
        "id":           e.id,
        "timestamp":    str(e.timestamp),
        "lane":         e.lane,
        "signal_state": e.signal_state,
        "duration":     e.duration,
        "is_manual":    bool(e.is_manual)
    } for e in events]

@router.get("/stats")
def get_signal_stats(db: Session = Depends(get_db)):
    """Signal statistics per lane — for graphical analysis"""
    stats = {}
    for lane in LANES:
        events = db.query(SignalEvent).filter(
            SignalEvent.lane == lane
        ).all()
        if events:
            durations = [e.duration for e in events if e.duration]
            stats[lane] = {
                "total_cycles": len(events),
                "avg_green_time": round(
                    sum(durations)/len(durations), 2
                ) if durations else 0,
                "manual_overrides": sum(
                    1 for e in events if e.is_manual
                )
            }
        else:
            stats[lane] = {
                "total_cycles": 0,
                "avg_green_time": 0,
                "manual_overrides": 0
            }
    return stats