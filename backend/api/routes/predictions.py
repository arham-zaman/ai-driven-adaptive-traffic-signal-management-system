from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import numpy as np
import pandas as pd
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db, Prediction
from backend.config import FEATURES, SEQUENCE_LENGTH, SAVED_MODELS_DIR, LANES

router = APIRouter(prefix="/predictions", tags=["predictions"])

# ─── Load models once at startup ──────────────────────────────
_gru_model  = None
_rf_model   = None
_xgb_model  = None

def get_gru_model():
    global _gru_model
    if _gru_model is None:
        from backend.models.gru_model import GRUModel
        _gru_model = GRUModel()
        _gru_model.load()
    return _gru_model

def get_rf_model():
    global _rf_model
    if _rf_model is None:
        from backend.models.rf_classifier import TrafficClassifier
        _rf_model = TrafficClassifier()
        _rf_model.load()
    return _rf_model

def get_xgb_model():
    global _xgb_model
    if _xgb_model is None:
        from backend.models.xgboost_classifier import XGBoostClassifier
        _xgb_model = XGBoostClassifier()
        _xgb_model.load()
    return _xgb_model


# ─── Full pipeline: detect → classify → predict green time ────
def run_pipeline(
    lane: str,
    vehicle_count: float,
    queue_length: float,
    avg_speed: float,
    density: float,
    db: Session
) -> dict:
    """
    Full integrated pipeline:
    1. RF/XGBoost classifies traffic level (LOW/MEDIUM/HIGH)
    2. GRU predicts exact green time (regression)
    3. PhaseManager gets the result
    4. Saved to DB
    """

    # ── Step 1: Classify traffic level ────────────────────────
    classifier_features = np.array([queue_length, avg_speed, density,
                                     vehicle_count])  # count_change approx
    try:
        rf  = get_rf_model()
        xgb = get_xgb_model()
        rf_result  = rf.predict_green_time(classifier_features)
        xgb_result = xgb.predict_green_time(classifier_features)
        # Use higher-confidence classifier result
        if rf_result["confidence"] >= xgb_result["confidence"]:
            best_clf = rf_result
        else:
            best_clf = xgb_result
    except Exception as e:
        best_clf = {"category": "MEDIUM", "green_time": 30,
                    "confidence": 0, "model": "fallback",
                    "error": str(e)}

    # ── Step 2: GRU regression → precise green time ───────────
    try:
        gru = get_gru_model()
        current = np.array([[vehicle_count, queue_length, avg_speed, density]])
        sequence = np.repeat(current, SEQUENCE_LENGTH, axis=0)
        gru_prediction = gru.predict(sequence)
        gru_prediction = max(10, min(60, gru_prediction))  # clamp 10-60s
    except Exception as e:
        # Fallback to classifier green time
        gru_prediction = best_clf["green_time"]

    # ── Step 3: Final decision — weighted blend ────────────────
    # GRU 60% + Classifier 40%
    final_green_time = round(
        0.6 * gru_prediction + 0.4 * best_clf["green_time"], 1
    )
    final_green_time = max(10, min(60, final_green_time))

    # ── Step 4: Save to DB ─────────────────────────────────────
    record = Prediction(
        lane=lane,
        predicted_green_time=final_green_time,
        model_used=f"pipeline(gru+{best_clf['model']})"
    )
    db.add(record)
    db.commit()

    return {
        "lane":                 lane,
        "predicted_green_time": final_green_time,
        "traffic_category":     best_clf["category"],
        "classifier_green":     best_clf["green_time"],
        "gru_green":            round(gru_prediction, 2),
        "classifier_confidence": best_clf["confidence"],
        "model_used":           f"pipeline(gru+{best_clf['model']})",
        "input": {
            "vehicle_count": vehicle_count,
            "queue_length":  queue_length,
            "avg_speed":     avg_speed,
            "density":       density
        }
    }


# ─── API Routes ───────────────────────────────────────────────

@router.get("/")
def get_all_predictions(db: Session = Depends(get_db)):
    predictions = db.query(Prediction).order_by(
        Prediction.timestamp.desc()
    ).limit(100).all()
    return [{
        "id":                   p.id,
        "timestamp":            str(p.timestamp),
        "lane":                 p.lane,
        "predicted_green_time": round(p.predicted_green_time, 2),
        "actual_green_time":    p.actual_green_time,
        "model_used":           p.model_used
    } for p in predictions]


@router.post("/predict")
def predict_green_time(
    lane: str,
    vehicle_count: float = 5,
    queue_length: float  = 2,
    avg_speed: float     = 20,
    density: float       = 0.5,
    db: Session = Depends(get_db)
):
    """Full pipeline prediction for a lane"""
    if lane not in LANES:
        return {"error": f"Invalid lane. Choose from {LANES}"}
    try:
        result = run_pipeline(
            lane, vehicle_count, queue_length,
            avg_speed, density, db
        )
        return result
    except Exception as e:
        return {"error": str(e)}


@router.post("/predict/all")
def predict_all_lanes(
    north_count: float = 5, south_count: float = 5,
    east_count: float  = 5, west_count: float  = 5,
    db: Session = Depends(get_db)
):
    """Predict green time for all 4 lanes at once"""
    lane_counts = {
        "north": north_count, "south": south_count,
        "east":  east_count,  "west":  west_count
    }
    results = {}
    for lane, count in lane_counts.items():
        try:
            results[lane] = run_pipeline(
                lane=lane,
                vehicle_count=count,
                queue_length=count * 0.8,
                avg_speed=20.0,
                density=min(count / 20.0, 1.0),
                db=db
            )
        except Exception as e:
            results[lane] = {"error": str(e)}
    return results


@router.get("/history/{lane}")
def get_lane_history(lane: str, db: Session = Depends(get_db)):
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
    stats = {}
    for lane in LANES:
        preds = db.query(Prediction).filter(
            Prediction.lane == lane
        ).all()
        if preds:
            times = [p.predicted_green_time for p in preds]
            stats[lane] = {
                "count": len(times),
                "avg":   round(sum(times) / len(times), 2),
                "max":   round(max(times), 2),
                "min":   round(min(times), 2)
            }
        else:
            stats[lane] = {"count": 0, "avg": 0, "max": 0, "min": 0}
    return stats