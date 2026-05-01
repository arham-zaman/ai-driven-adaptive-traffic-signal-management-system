from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db, TrafficLog, SignalEvent, Prediction
from backend.config import LANES

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/add")
def add_traffic_log(
    lane:          str,
    vehicle_count: int,
    queue_length:  float = 0.0,
    avg_speed:     float = 20.0,
    density:       float = 0.0,
    db: Session = Depends(get_db)
):
    """Called by demo_runner.py — saves real YOLO detection data."""
    log = TrafficLog(
        lane          = lane,
        vehicle_count = vehicle_count,
        queue_length  = queue_length,
        avg_speed     = avg_speed,
        density       = density,
    )
    db.add(log)
    db.commit()
    return {"success": True, "lane": lane, "vehicle_count": vehicle_count}


@router.get("/")
def get_all_logs(
    limit: int = Query(100, ge=1, le=1000),
    lane:  str = Query(None),
    db: Session = Depends(get_db)
):
    """Get traffic logs — filterable by lane."""
    q = db.query(TrafficLog).order_by(TrafficLog.timestamp.desc())
    if lane and lane in LANES:
        q = q.filter(TrafficLog.lane == lane)
    logs = q.limit(limit).all()
    return [{
        "id":            l.id,
        "timestamp":     str(l.timestamp),
        "lane":          l.lane,
        "vehicle_count": l.vehicle_count,
        "queue_length":  l.queue_length,
        "avg_speed":     l.avg_speed,
        "density":       l.density
    } for l in logs]


@router.get("/signals")
def get_signal_logs(
    limit: int = Query(100, ge=1, le=1000),
    lane:  str = Query(None),
    db: Session = Depends(get_db)
):
    """Get signal event logs."""
    q = db.query(SignalEvent).order_by(SignalEvent.timestamp.desc())
    if lane and lane in LANES:
        q = q.filter(SignalEvent.lane == lane)
    events = q.limit(limit).all()
    return [{
        "id":           e.id,
        "timestamp":    str(e.timestamp),
        "lane":         e.lane,
        "signal_state": e.signal_state,
        "duration":     e.duration,
        "is_manual":    bool(e.is_manual)
    } for e in events]


@router.get("/predictions")
def get_prediction_logs(
    limit: int = Query(100, ge=1, le=1000),
    lane:  str = Query(None),
    db: Session = Depends(get_db)
):
    """Get prediction logs."""
    q = db.query(Prediction).order_by(Prediction.timestamp.desc())
    if lane and lane in LANES:
        q = q.filter(Prediction.lane == lane)
    preds = q.limit(limit).all()
    return [{
        "id":                   p.id,
        "timestamp":            str(p.timestamp),
        "lane":                 p.lane,
        "predicted_green_time": round(p.predicted_green_time, 2),
        "model_used":           p.model_used
    } for p in preds]


@router.get("/summary")
def get_logs_summary(db: Session = Depends(get_db)):
    """Summary stats for logs page."""
    total_traffic  = db.query(func.count(TrafficLog.id)).scalar()  or 0
    total_signals  = db.query(func.count(SignalEvent.id)).scalar() or 0
    total_preds    = db.query(func.count(Prediction.id)).scalar()  or 0
    manual_count   = db.query(func.count(SignalEvent.id)).filter(
        SignalEvent.is_manual == 1
    ).scalar() or 0

    # Average prediction error where actual was recorded
    preds_with_actual = db.query(Prediction).filter(
        Prediction.actual_green_time.isnot(None)
    ).all()
    if preds_with_actual:
        errors    = [abs(p.predicted_green_time - p.actual_green_time)
                     for p in preds_with_actual]
        avg_error = f"{sum(errors)/len(errors):.2f}s"
    else:
        avg_error = "N/A"

    return {
        "total_traffic_logs":    total_traffic,
        "total_signal_events":   total_signals,
        "total_predictions":     total_preds,
        "manual_overrides":      manual_count,
        "predictions_evaluated": len(preds_with_actual),
        "avg_prediction_error":  avg_error,
        "lanes":                 LANES
    }


@router.delete("/clear")
def clear_logs(db: Session = Depends(get_db)):
    """Clear all logs — for testing only."""
    db.query(TrafficLog).delete()
    db.query(SignalEvent).delete()
    db.query(Prediction).delete()
    db.commit()
    return {"message": "All logs cleared!"}