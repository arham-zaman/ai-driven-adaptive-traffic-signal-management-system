import sys
import pandas as pd
import numpy as np
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import PROCESSED_DIR, SAVED_MODELS_DIR, LANES
from sklearn.model_selection import train_test_split

def main():
    print("\n" + "="*70)
    print(" "*15 + "IMPROVED FYP TRAINING PIPELINE")
    print("="*70)

    # ── Load data ─────────────────────────────────────────────
    print("\n[1/4] Loading data...")
    dfs = []
    for csv_file in sorted(PROCESSED_DIR.glob("*_features.csv")):
        dfs.append(pd.read_csv(csv_file))

    if not dfs:
        print("No CSV files found!")
        return

    df = pd.concat(dfs, ignore_index=True)
    print(f"Total: {len(df)} rows loaded")

    # ── Improved GRU ──────────────────────────────────────────
    print("\n[2/4] Training Improved GRU (Custom Huber Loss)...")
    from backend.models.gru_model_improved import GRUModelImproved
    gru = GRUModelImproved()
    gru.build(loss_type='huber_weighted')
    gru_history = gru.train(df)
    best_gru_mae = min(gru_history.history['val_mae'])
    print(f"GRU Improved — Best Val MAE: {best_gru_mae:.2f}s")

    # ── Improved Classifiers (RF + XGBoost both) ──────────────
    print("\n[3/4] Training Improved Classifiers (RF + XGBoost)...")
    clf_features = ["queue_length", "density", "congestion_ratio", "count_change"]
    X = df[clf_features].values
    y = df["category"].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    from backend.models.optimized_classifier import OptimizedTrafficClassifier
    clf = OptimizedTrafficClassifier()
    clf.train(X_train, y_train, X_test, y_test)

    # ── Summary ───────────────────────────────────────────────
    print("\n[4/4] Summary")
    print("="*70)
    print(f"GRU Improved   — Val MAE: {best_gru_mae:.2f}s")
    print(f"RF Classifier  — Saved")
    print(f"XGBoost        — Saved")
    print("="*70)
    print("Run next: python -m backend.models.evaluate_improved")


if __name__ == "__main__":
    main()