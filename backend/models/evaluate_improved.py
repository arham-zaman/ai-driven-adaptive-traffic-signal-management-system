import sys
import pandas as pd
import numpy as np
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import PROCESSED_DIR, SAVED_MODELS_DIR
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

def main():
    print("\n" + "="*70)
    print("EVALUATING ALL IMPROVED MODELS")
    print("="*70)

    # ── Load data ─────────────────────────────────────────────
    print("\nLoading data...")
    dfs = []
    for csv_file in sorted(PROCESSED_DIR.glob("*_features.csv")):
        dfs.append(pd.read_csv(csv_file))
    df = pd.concat(dfs, ignore_index=True)
    print(f"Total samples: {len(df)}")

    results = {}

    # ── [1] GRU Improved ──────────────────────────────────────
    print("\n[1/2] Evaluating Improved GRU...")
    try:
        from backend.models.gru_model_improved import GRUModelImproved
        gru = GRUModelImproved()
        gru.load()
        gru_results = gru.evaluate(df)
        results['gru'] = gru_results
    except Exception as e:
        print(f"  GRU eval failed: {e}")

    # ── [2] Classifiers (RF + XGBoost) ────────────────────────
    print("\n[2/2] Evaluating Classifiers (RF + XGBoost)...")
    try:
        from backend.models.optimized_classifier import OptimizedTrafficClassifier

        clf_features = ["queue_length", "density", "congestion_ratio", "count_change"]
        X = df[clf_features].values
        y = df["category"].values
        _, X_test, _, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        clf = OptimizedTrafficClassifier()
        clf.load()
        clf_results = clf.evaluate(X_test, y_test)
        results['classifiers'] = clf_results
    except Exception as e:
        print(f"  Classifier eval failed: {e}")

    # ── Final Summary ─────────────────────────────────────────
    print("\n" + "="*70)
    print("FINAL RESULTS SUMMARY")
    print("="*70)

    BASELINE_GRU = 11.24   # Basic GRU MAE (seconds)
    BASELINE_CLF = 88.01   # Basic XGBoost accuracy (%)

    print("\n REGRESSION — Green Time Prediction")
    print("-"*70)
    if 'gru' in results:
        g = results['gru']
        imp = ((BASELINE_GRU - g['mae']) / BASELINE_GRU) * 100
        print(f"  GRU Improved MAE  : {g['mae']:.2f}s  (baseline {BASELINE_GRU}s → {imp:+.1f}%)")
        print(f"  RMSE              : {g['rmse']:.2f}s")
        print(f"  Light  (10-20s)   : {g['mae_light']:.2f}s")
        print(f"  Normal (20-40s)   : {g['mae_normal']:.2f}s  ← MOST IMPORTANT")
        print(f"  Heavy  (40-60s)   : {g['mae_heavy']:.2f}s")

    print("\n CLASSIFICATION — Traffic Level")
    print("-"*70)
    if 'classifiers' in results:
        for name, r in results['classifiers'].items():
            imp = ((r['accuracy'] - BASELINE_CLF/100) / (BASELINE_CLF/100)) * 100
            print(f"  {name:<16}: {r['accuracy']*100:.2f}%  ({imp:+.1f}% vs baseline)")

    print("\n" + "="*70)
    print("EVALUATION COMPLETE")
    print("="*70)

    return results


if __name__ == "__main__":
    main()