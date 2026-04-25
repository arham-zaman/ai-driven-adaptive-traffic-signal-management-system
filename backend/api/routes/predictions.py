from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import numpy as np
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db, Prediction, TrafficLog
from backend.config import FEATURES, SEQUENCE_LENGTH, SAVED_MODELS_DIR, LANES

router = APIRouter(prefix="/predictions", tags=["predictions"])

# ─── Load models once ─────────────────────────────────────────
_gru_model = None
_rf_model  = None
_xgb_model = None

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


def run_pipeline(
    lane: str,
    vehicle_count: float,
    queue_length: float,
    density: float,
    congestion_ratio: float,
    count_change: float,
    db: Session
) -> dict:
    """
    Full AI pipeline:
    1. RF + XGBoost  → classify traffic level (LOW/MEDIUM/HIGH)
    2. GRU           → predict exact green time (seconds)
    3. Weighted blend → final decision
    4. Save to DB
    """
    lane = lane.lower()

    # ── Step 1: Classify traffic level ────────────────────────
    # ✅ FIXED: Correct feature order to match scaler!
    clf_features = np.array([
        queue_length,
        density,
        congestion_ratio,
        count_change
    ])
    
    try:
        rf         = get_rf_model()
        xgb        = get_xgb_model()
        rf_result  = rf.predict_green_time(clf_features)
        xgb_result = xgb.predict_green_time(clf_features)
        best_clf   = rf_result if rf_result["confidence"] >= xgb_result["confidence"] \
                     else xgb_result
    except Exception as e:
        best_clf = {"category": "MEDIUM", "green_time": 30,
                    "confidence": 0, "model": "fallback", "error": str(e)}

    # ── Step 2: GRU → exact green time in seconds ─────────────
    try:
        gru      = get_gru_model()
        # Create sequence for GRU prediction
        current  = np.array([[vehicle_count, queue_length, density, congestion_ratio]])
        sequence = np.repeat(current, SEQUENCE_LENGTH, axis=0)
        gru_time = gru.predict(sequence)  # Direct 10-60s value
    except Exception as e:
        gru_time = float(best_clf["green_time"])

    # ── Step 3: Weighted blend ─────────────────────────────────
    final_time = round(0.6 * gru_time + 0.4 * best_clf["green_time"], 1)
    final_time = float(np.clip(final_time, 10, 60))

    # ── Step 4: Save TrafficLog ────────────────────────────────
    log = TrafficLog(
        lane          = lane,
        vehicle_count = int(vehicle_count),
        queue_length  = queue_length,
        avg_speed     = 0.0,  # Not used anymore
        density       = density
    )
    db.add(log)

    # ── Step 5: Save Prediction ────────────────────────────────
    record = Prediction(
        lane                 = lane,
        predicted_green_time = final_time,
        model_used           = f"pipeline(gru+{best_clf['model']})"
    )
    db.add(record)
    db.commit()

    return {
        "lane":                  lane,
        "predicted_green_time":  final_time,
        "traffic_category":      best_clf["category"],
        "classifier_green":      best_clf["green_time"],
        "gru_green":             round(gru_time, 2),
        "classifier_confidence": best_clf["confidence"],
        "model_used":            f"pipeline(gru+{best_clf['model']})",
        "input": {
            "vehicle_count":    vehicle_count,
            "queue_length":     queue_length,
            "density":          density,
            "congestion_ratio": congestion_ratio,
            "count_change":     count_change
        }
    }


@router.get("/")
def get_all_predictions(db: Session = Depends(get_db)):
    preds = db.query(Prediction).order_by(
        Prediction.timestamp.desc()
    ).limit(100).all()
    return [{
        "id":                   p.id,
        "timestamp":            str(p.timestamp),
        "lane":                 p.lane,
        "predicted_green_time": round(p.predicted_green_time, 2),
        "actual_green_time":    p.actual_green_time,
        "model_used":           p.model_used
    } for p in preds]


@router.post("/predict")
def predict_green_time(
    lane: str,
    vehicle_count: float = 5,
    queue_length: float  = 2,
    density: float       = 0.5,
    congestion_ratio: float = 0.4,
    count_change: float = 1,
    db: Session = Depends(get_db)
):
    """Full AI pipeline prediction for a lane"""
    if lane.lower() not in LANES:
        return {"error": f"Invalid lane. Choose from {LANES}"}
    try:
        return run_pipeline(lane, vehicle_count, queue_length,
                            density, congestion_ratio, count_change, db)
    except Exception as e:
        return {"error": str(e)}


@router.post("/predict/all")
def predict_all_lanes(
    north_count: float = 5, south_count: float = 5,
    east_count:  float = 5, west_count:  float = 5,
    db: Session = Depends(get_db)
):
    """Predict green time for all 4 lanes at once"""
    counts = {"north": north_count, "south": south_count,
              "east": east_count,   "west": west_count}
    results = {}
    for lane, count in counts.items():
        try:
            results[lane] = run_pipeline(
                lane=lane, 
                vehicle_count=count,
                queue_length=count * 0.8, 
                density=min(count / 20.0, 1.0),
                congestion_ratio=min(1.0, (count * 0.8) / max(count, 1)),
                count_change=1,
                db=db
            )
        except Exception as e:
            results[lane] = {"error": str(e)}
    return results


@router.post("/update_actual/{prediction_id}")
def update_actual_green_time(
    prediction_id: int,
    actual_time: float,
    db: Session = Depends(get_db)
):
    """Update actual green time after signal cycle completes"""
    pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not pred:
        return {"error": "Prediction not found"}
    pred.actual_green_time = actual_time
    db.commit()
    return {
        "success":    True,
        "id":         prediction_id,
        "predicted":  pred.predicted_green_time,
        "actual":     actual_time,
        "difference": round(abs(pred.predicted_green_time - actual_time), 2)
    }


@router.get("/history/{lane}")
def get_lane_history(lane: str, db: Session = Depends(get_db)):
    preds = db.query(Prediction).filter(
        Prediction.lane == lane.lower()
    ).order_by(Prediction.timestamp.desc()).limit(50).all()
    return [{
        "timestamp":            str(p.timestamp),
        "predicted_green_time": round(p.predicted_green_time, 2),
        "actual_green_time":    p.actual_green_time,
        "model_used":           p.model_used
    } for p in preds]


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