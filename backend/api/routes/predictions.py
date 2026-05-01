import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from backend.database.db import get_db, Prediction, TrafficLog
from backend.config import FEATURES, SEQUENCE_LENGTH, SAVED_MODELS_DIR, LANES

router = APIRouter(prefix="/predictions", tags=["predictions"])

# ─────────────────────────────────────────────────────────────────────────────
# MODEL SELECTION RATIONALE (for FYP presentation):
#
#   REGRESSION  → Trained both LSTM and GRU.
#                 GRU achieved lower MAE → GRU Improved selected.
#
#   CLASSIFIER  → Trained both Random Forest and XGBoost.
#                 XGBoost (Optuna-tuned via OptimizedTrafficClassifier)
#                 achieved higher accuracy → XGBoost selected.
#
#   Both baseline models (lstm_model.py, rf_classifier.py) are kept in
#   the codebase for evaluation comparison — they are NOT used in the
#   live inference pipeline.
# ─────────────────────────────────────────────────────────────────────────────

# ─── Load models once (singleton pattern) ────────────────────
_gru_model       = None
_classifier      = None   # OptimizedTrafficClassifier (best = XGBoost)

def get_gru_model():
    """
    Regression model — GRU Improved selected over LSTM.
    (LSTM is kept in models/ for comparison only.)
    """
    global _gru_model
    if _gru_model is None:
        from backend.models.gru_model_improved import GRUModelImproved
        _gru_model = GRUModelImproved()
        _gru_model.load()
    return _gru_model

def get_classifier():
    """
    Classification model — OptimizedTrafficClassifier auto-selects
    the best between RF and XGBoost. In practice XGBoost wins.
    (Basic rf_classifier.py and xgboost_classifier.py are kept for
    evaluation comparison only.)
    """
    global _classifier
    if _classifier is None:
        from backend.models.optimized_classifier import OptimizedTrafficClassifier
        _classifier = OptimizedTrafficClassifier()
        _classifier.load()
    return _classifier


# ─── Core pipeline ───────────────────────────────────────────
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
    Full AI inference pipeline:
      1. OptimizedClassifier (XGBoost) → traffic category LOW/MEDIUM/HIGH
      2. GRU Improved                  → exact green time in seconds
      3. Weighted blend (60/40)        → final green time
      4. Persist to DB
    """
    lane = lane.lower()

    # ── Step 1: Classify traffic level (XGBoost wins) ────────
    clf_features = np.array([
        queue_length,
        density,
        congestion_ratio,
        count_change
    ])

    try:
        clf        = get_classifier()
        clf_result = clf.predict(clf_features)
        # clf_result = {"category": "HIGH", "confidence": 92.3, "model_used": "XGBoost"}
        category   = clf_result["category"]
        clf_conf   = clf_result["confidence"]
        clf_model  = clf_result.get("model_used", "optimized")

        # Map category → fallback green time
        category_green = {"LOW": 15, "MEDIUM": 30, "HIGH": 50}
        clf_green_time = category_green.get(category, 30)

    except Exception as e:
        category      = "MEDIUM"
        clf_green_time = 30
        clf_conf       = 0
        clf_model      = "fallback"
        print(f"[Classifier fallback] {e}")

    # ── Step 2: GRU Improved → exact green time ──────────────
    try:
        gru      = get_gru_model()
        current  = np.array([[vehicle_count, queue_length,
                               density, congestion_ratio]])
        sequence = np.repeat(current, SEQUENCE_LENGTH, axis=0)
        gru_time = gru.predict(sequence)
    except Exception as e:
        gru_time = float(clf_green_time)
        print(f"[GRU fallback] {e}")

    # ── Step 3: Weighted blend ────────────────────────────────
    # GRU is the primary regressor (60%), classifier provides
    # a category-based sanity check (40%).
    final_time = round(0.6 * gru_time + 0.4 * clf_green_time, 1)
    final_time = float(np.clip(final_time, 10, 60))

    # ── Step 4: Persist ──────────────────────────────────────
    log = TrafficLog(
        lane          = lane,
        vehicle_count = int(vehicle_count),
        queue_length  = queue_length,
        avg_speed     = 0.0,
        density       = density
    )
    db.add(log)

    record = Prediction(
        lane                 = lane,
        predicted_green_time = final_time,
        model_used           = f"GRU_improved+{clf_model}"
    )
    db.add(record)
    db.commit()

    return {
        "lane":                  lane,
        "predicted_green_time":  final_time,
        "traffic_category":      category,
        "classifier_green":      clf_green_time,
        "gru_green":             round(gru_time, 2),
        "classifier_confidence": clf_conf,
        "classifier_model":      clf_model,
        "model_used":            f"GRU_improved+{clf_model}",
        "input": {
            "vehicle_count":    vehicle_count,
            "queue_length":     queue_length,
            "density":          density,
            "congestion_ratio": congestion_ratio,
            "count_change":     count_change
        }
    }


# ─── Routes ──────────────────────────────────────────────────

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
    vehicle_count: float    = 5,
    queue_length: float     = 2,
    density: float          = 0.5,
    congestion_ratio: float = 0.4,
    count_change: float     = 1,
    db: Session = Depends(get_db)
):
    """Full AI pipeline prediction for a single lane."""
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
    """Predict green time for all 4 lanes simultaneously."""
    counts  = {"north": north_count, "south": south_count,
               "east":  east_count,  "west":  west_count}
    results = {}
    for lane, count in counts.items():
        try:
            results[lane] = run_pipeline(
                lane             = lane,
                vehicle_count    = count,
                queue_length     = count * 0.8,
                density          = min(count / 20.0, 1.0),
                congestion_ratio = min(1.0, (count * 0.8) / max(count, 1)),
                count_change     = 1,
                db               = db
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
    """Record actual green time once a signal cycle completes."""
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