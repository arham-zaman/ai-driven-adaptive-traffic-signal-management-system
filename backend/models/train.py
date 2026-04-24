import sys
import pandas as pd
import numpy as np
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import PROCESSED_DIR, SAVED_MODELS_DIR, FEATURES
from backend.models.lstm_model import LSTMModel
from backend.models.gru_model import GRUModel

def load_all_data():
    """Load and combine all CSV files"""
    dfs = []
    for csv_file in PROCESSED_DIR.glob("*.csv"):
        df = pd.read_csv(csv_file)
        dfs.append(df)
        print(f"Loaded: {csv_file.stem} — {len(df)} rows")

    combined = pd.concat(dfs, ignore_index=True)
    combined = combined.sort_values("time_sec").reset_index(drop=True)

    for col in FEATURES:
        if col not in combined.columns:
            combined[col] = 0.0

    print(f"\nTotal rows: {len(combined)}")
    print(f"Features: {FEATURES}")
    print(f"Sample:\n{combined[FEATURES].head()}")
    return combined

def train_lstm(df: pd.DataFrame):
    """Train LSTM — Regression (predicts green time)"""
    print("\n" + "="*50)
    print("Training LSTM (Regression)...")

    lstm = LSTMModel()
    lstm.build()
    history = lstm.train(df)

    final_mae  = min(history.history['val_mae'])
    final_loss = min(history.history['val_loss'])
    print(f"LSTM — Best Val MAE: {final_mae:.4f} | Best Val Loss: {final_loss:.4f}")
    return {"mae": final_mae, "loss": final_loss}

def train_gru(df: pd.DataFrame):
    """Train GRU — Regression (predicts green time)"""
    print("\n" + "="*50)
    print("Training GRU (Regression)...")

    gru = GRUModel()
    gru.build()
    history = gru.train(df)

    final_mae  = min(history.history['val_mae'])
    final_loss = min(history.history['val_loss'])
    print(f"GRU — Best Val MAE: {final_mae:.4f} | Best Val Loss: {final_loss:.4f}")
    return {"mae": final_mae, "loss": final_loss}


if __name__ == "__main__":
    df = load_all_data()
    results = {}

    # ── Regression Models (Green Time Prediction) ─────────────
    results["LSTM"] = train_lstm(df)
    results["GRU"]  = train_gru(df)

    # ── Classification Models (Traffic Level) ─────────────────
    print("\n" + "="*50)
    print("Training Random Forest Classifier (Classification)...")
    from backend.models.rf_classifier import TrafficClassifier
    rf = TrafficClassifier()
    rf.get_distribution(df)
    rf_result = rf.train(df)
    results["RandomForest"] = rf_result

    print("\n" + "="*50)
    print("Training XGBoost Classifier (Classification)...")
    from backend.models.xgboost_classifier import XGBoostClassifier
    xgb = XGBoostClassifier()
    xgb_result = xgb.train(df)
    results["XGBoost_Clf"] = xgb_result

    # ── Final Comparison Table ─────────────────────────────────
    print("\n" + "="*60)
    print("FINAL MODEL COMPARISON")
    print("="*60)
    print(f"{'Model':<18} {'Type':<18} {'Metric':<12} {'Value'}")
    print("-"*60)
    print(f"{'LSTM':<18} {'Regression':<18} {'MAE':<12} {results['LSTM']['mae']:.4f}")
    print(f"{'GRU':<18} {'Regression':<18} {'MAE':<12} {results['GRU']['mae']:.4f}")
    print(f"{'Random Forest':<18} {'Classification':<18} {'Accuracy':<12} {results['RandomForest']['accuracy']*100:.2f}%")
    print(f"{'XGBoost':<18} {'Classification':<18} {'Accuracy':<12} {results['XGBoost_Clf']['accuracy']*100:.2f}%")
    print("="*60)
    print("\nRegression  → Lower MAE = Better")
    print("Classification → Higher Accuracy = Better")
    print("\nAll models trained and saved!")
    print(f"Models in: {SAVED_MODELS_DIR}")