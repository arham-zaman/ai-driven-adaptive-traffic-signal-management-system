from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import numpy as np
import pandas as pd
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db
from backend.database.db import Prediction
from backend.config import FEATURES, SEQUENCE_LENGTH, SAVED_MODELS_DIR, LANES

router = APIRouter(prefix="/predictions", tags=["predictions"])

# ─── Load GRU model once at startup ───────────────────────────
gru_model = None
def get_gru_model():
    global gru_model
    if gru_model is None:
        from backend.models.gru_model import GRUModel
        gru_model = GRUModel()
        gru_model.load()
    return gru_model

@router.get("/")
def get_all_predictions(db: Session = Depends(get_db)):
    """Get all predictions from database"""
    predictions = db.query(Prediction).order_by(
        Prediction.timestamp.desc()
    ).limit(100).all()
    
    return [{
        "id":           p.id,
        "timestamp":    str(p.timestamp),
        "lane":         p.lane,
        "predicted_green_time": round(p.predicted_green_time, 2),
        "actual_green_time":    p.actual_green_time,
        "model_used":   p.model_used
    } for p in predictions]

@router.post("/predict")
def predict_green_time(
    lane: str,
    vehicle_count: float = 5,
    queue_length: float = 2,
    avg_speed: float = 20,
    density: float = 0.5,
    db: Session = Depends(get_db)
):
    """Predict green time for a lane using GRU model"""
    if lane not in LANES:
        return {"error": f"Invalid lane. Choose from {LANES}"}

    try:
        model = get_gru_model()

        # Build sequence from current values
        current = np.array([[vehicle_count, queue_length, avg_speed, density]])
        sequence = np.repeat(current, SEQUENCE_LENGTH, axis=0)

        predicted = model.predict(sequence)
        predicted = max(10, min(60, predicted))  # clamp 10-60 sec

        # Save to DB
        record = Prediction(
            lane=lane,
            predicted_green_time=predicted,
            model_used="gru"
        )
        db.add(record)
        db.commit()

        return {
            "lane":                 lane,
            "predicted_green_time": round(predicted, 2),
            "model_used":           "gru",
            "input": {
                "vehicle_count": vehicle_count,
                "queue_length":  queue_length,
                "avg_speed":     avg_speed,
                "density":       density
            }
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/history/{lane}")
def get_lane_history(lane: str, db: Session = Depends(get_db)):
    """Get prediction history for a specific lane"""
    predictions = db.query(Prediction).filter(
        Prediction.lane == lane
    ).order_by(Prediction.timestamp.desc()).limit(50).all()

    return [{
        "timestamp":            str(p.timestamp),
        "predicted_green_time": round(p.predicted_green_time, 2),
        "model_used":           p.model_used
    } for p in predictions]

@router.get("/stats")
def get_prediction_stats(db: Session = Depends(get_db)):
    """Get prediction statistics per lane"""
    stats = {}
    for lane in LANES:
        preds = db.query(Prediction).filter(
            Prediction.lane == lane
        ).all()
        if preds:
            times = [p.predicted_green_time for p in preds]
            stats[lane] = {
                "count":   len(times),
                "avg":     round(sum(times) / len(times), 2),
                "max":     round(max(times), 2),
                "min":     round(min(times), 2)
            }
        else:
            stats[lane] = {"count": 0, "avg": 0, "max": 0, "min": 0}
    return stats