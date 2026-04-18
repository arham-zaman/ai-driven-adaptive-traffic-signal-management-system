from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db, TrafficLog, SignalEvent, Prediction
from backend.config import LANES

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/")
def get_all_logs(
    limit: int = 100,
    lane: str = None,
    db: Session = Depends(get_db)
):
    """Get traffic logs — filterable by lane"""
    query = db.query(TrafficLog).order_by(TrafficLog.timestamp.desc())
    if lane and lane in LANES:
        query = query.filter(TrafficLog.lane == lane)
    logs = query.limit(limit).all()

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
    limit: int = 100,
    lane: str = None,
    db: Session = Depends(get_db)
):
    """Get signal event logs"""
    query = db.query(SignalEvent).order_by(SignalEvent.timestamp.desc())
    if lane and lane in LANES:
        query = query.filter(SignalEvent.lane == lane)
    events = query.limit(limit).all()

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
    limit: int = 100,
    lane: str = None,
    db: Session = Depends(get_db)
):
    """Get prediction logs"""
    query = db.query(Prediction).order_by(Prediction.timestamp.desc())
    if lane and lane in LANES:
        query = query.filter(Prediction.lane == lane)
    preds = query.limit(limit).all()

    return [{
        "id":                   p.id,
        "timestamp":            str(p.timestamp),
        "lane":                 p.lane,
        "predicted_green_time": round(p.predicted_green_time, 2),
        "model_used":           p.model_used
    } for p in preds]

@router.get("/summary")
def get_logs_summary(db: Session = Depends(get_db)):
    """Summary stats for logs page"""
    total_logs      = db.query(TrafficLog).count()
    total_signals   = db.query(SignalEvent).count()
    total_preds     = db.query(Prediction).count()
    manual_count    = db.query(SignalEvent).filter(
        SignalEvent.is_manual == 1
    ).count()

    return {
        "total_traffic_logs":   total_logs,
        "total_signal_events":  total_signals,
        "total_predictions":    total_preds,
        "manual_overrides":     manual_count,
        "lanes":                LANES
    }

@router.delete("/clear")
def clear_logs(db: Session = Depends(get_db)):
    """Clear all logs — for testing"""
    db.query(TrafficLog).delete()
    db.query(SignalEvent).delete()
    db.query(Prediction).delete()
    db.commit()
    return {"message": "All logs cleared!"}