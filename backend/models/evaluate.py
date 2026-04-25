import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import (
    PROCESSED_DIR, SAVED_MODELS_DIR, FEATURES,
    MIN_GREEN_TIME, MAX_GREEN_TIME
)

sns.set_theme(style="whitegrid")
COLORS = ["#3498db", "#e74c3c", "#2ecc71"]

# ✅ FIXED: Must match config.py!
CLASSIFIER_FEATURES = ["queue_length", "density", "congestion_ratio", "count_change"]


def load_data():
    dfs = []
    for csv_file in PROCESSED_DIR.glob("*.csv"):
        dfs.append(pd.read_csv(csv_file))
    if not dfs:
        raise FileNotFoundError(f"No CSV files in {PROCESSED_DIR}")
    return pd.concat(dfs, ignore_index=True)


def get_category(vehicle_count):
    if vehicle_count <= 5:
        return "LOW"
    elif vehicle_count <= 15:
        return "MEDIUM"
    else:
        return "HIGH"


def evaluate_all_models():
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error, accuracy_score

    df = load_data()
    print(f"Total data: {len(df)} rows")
    print(f"Columns: {df.columns.tolist()}")

    # Verify classifier features exist
    missing = [f for f in CLASSIFIER_FEATURES if f not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in CSV: {missing}. "
                         f"Run process_videos.py first!")

    results = {}

    # ── XGBoost Classifier ────────────────────────────────────
    print("\nEvaluating XGBoost Classifier...")
    try:
        from backend.models.xgboost_classifier import XGBoostClassifier
        xgb = XGBoostClassifier()
        xgb.load()

        X_clf     = df[CLASSIFIER_FEATURES].values
        y_clf_raw = df["vehicle_count"].apply(get_category).values
        y_clf_enc = xgb.le.transform(y_clf_raw)
        X_scaled  = xgb.scaler.transform(X_clf)

        _, X_test, _, y_test = train_test_split(
            X_scaled, y_clf_enc, test_size=0.2, random_state=42
        )
        y_pred = xgb.model.predict(X_test)
        acc    = accuracy_score(y_test, y_pred)

        results["XGBoost"] = {
            "accuracy": acc,
            "y_pred":   y_pred,
            "y_test":   y_test,
            "type":     "classifier",
            "le":       xgb.le
        }
        print(f"XGBoost Accuracy: {acc*100:.2f}%")
    except Exception as e:
        print(f"XGBoost eval failed: {e}")

    # ── Random Forest Classifier ──────────────────────────────
    print("Evaluating Random Forest Classifier...")
    try:
        from backend.models.rf_classifier import TrafficClassifier
        rf = TrafficClassifier()
        rf.load()

        X_rf    = df[CLASSIFIER_FEATURES].values
        y_rf    = df["vehicle_count"].apply(get_category).values
        X_scaled = rf.scaler.transform(X_rf)

        _, X_test, _, y_test = train_test_split(
            X_scaled, y_rf, test_size=0.2, random_state=42
        )
        y_pred = rf.model.predict(X_test)
        acc    = accuracy_score(y_test, y_pred)

        results["RandomForest"] = {
            "accuracy": acc,
            "y_pred":   y_pred,
            "y_test":   y_test,
            "type":     "classifier"
        }
        print(f"Random Forest Accuracy: {acc*100:.2f}%")
    except Exception as e:
        print(f"RF eval failed: {e}")

    # ── LSTM ──────────────────────────────────────────────────
    print("Evaluating LSTM...")
    try:
        from backend.models.lstm_model import LSTMModel
        lstm = LSTMModel()
        lstm.load()

        X_seq, y_true = lstm.prepare_sequences(df, shuffle=False)
        _, X_test, _, y_test = train_test_split(
            X_seq, y_true, test_size=0.2, random_state=42
        )
        # ✅ FIXED: Direct green_time values (no denormalization needed!)
        y_pred = lstm.model.predict(X_test, verbose=0).flatten()
        y_pred = np.clip(y_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)

        mae  = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))

        results["LSTM"] = {
            "mae":    mae,
            "rmse":   rmse,
            "y_pred": y_pred,
            "y_test": y_test,
            "type":   "regression"
        }
        print(f"LSTM — MAE: {mae:.2f}s | RMSE: {rmse:.2f}s")
    except Exception as e:
        print(f"LSTM eval failed: {e}")

    # ── GRU ───────────────────────────────────────────────────
    print("Evaluating GRU...")
    try:
        from backend.models.gru_model import GRUModel
        gru = GRUModel()
        gru.load()

        X_seq, y_true = gru.prepare_sequences(df, shuffle=False)
        _, X_test, _, y_test = train_test_split(
            X_seq, y_true, test_size=0.2, random_state=42
        )
        # ✅ FIXED: Direct green_time values (no denormalization needed!)
        y_pred = gru.model.predict(X_test, verbose=0).flatten()
        y_pred = np.clip(y_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)

        mae  = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))

        results["GRU"] = {
            "mae":    mae,
            "rmse":   rmse,
            "y_pred": y_pred,
            "y_test": y_test,
            "type":   "regression"
        }
        print(f"GRU — MAE: {mae:.2f}s | RMSE: {rmse:.2f}s")
    except Exception as e:
        print(f"GRU eval failed: {e}")

    return results


def plot_comparison(results: dict):
    save_dir = SAVED_MODELS_DIR
    save_dir.mkdir(parents=True, exist_ok=True)

    reg_models = {k: v for k, v in results.items() if v.get("type") == "regression"}
    clf_models = {k: v for k, v in results.items() if v.get("type") == "classifier"}

    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle("AI Traffic Signal — Model Evaluation", fontsize=16, fontweight='bold')

    # Chart 1: MAE (seconds)
    if reg_models:
        names = list(reg_models.keys())
        maes  = [reg_models[m]["mae"] for m in names]
        bars  = axes[0, 0].bar(names, maes, color=COLORS[:len(names)])
        axes[0, 0].set_title("Regression — MAE (seconds)\n(Lower = Better)")
        axes[0, 0].set_ylabel("Mean Absolute Error (seconds)")
        for bar, val in zip(bars, maes):
            axes[0, 0].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.1,
                f"{val:.2f}s", ha='center', fontsize=11, fontweight='bold'
            )

    # Chart 2: RMSE (seconds)
    if reg_models:
        names = list(reg_models.keys())
        rmses = [reg_models[m]["rmse"] for m in names]
        bars  = axes[0, 1].bar(names, rmses, color=COLORS[:len(names)])
        axes[0, 1].set_title("Regression — RMSE (seconds)\n(Lower = Better)")
        axes[0, 1].set_ylabel("Root Mean Square Error (seconds)")
        for bar, val in zip(bars, rmses):
            axes[0, 1].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.1,
                f"{val:.2f}s", ha='center', fontsize=11, fontweight='bold'
            )

    # Chart 3: Classification Accuracy
    if clf_models:
        names = list(clf_models.keys())
        accs  = [clf_models[m]["accuracy"] * 100 for m in names]
        bars  = axes[0, 2].bar(names, accs,
                               color=["#9b59b6", "#f39c12"][:len(names)])
        axes[0, 2].set_title("Classification — Accuracy\n(Higher = Better)")
        axes[0, 2].set_ylabel("Accuracy (%)")
        axes[0, 2].set_ylim(0, 110)
        for bar, val in zip(bars, accs):
            axes[0, 2].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.5,
                f"{val:.2f}%", ha='center', fontsize=11, fontweight='bold'
            )

    # Chart 4: LSTM Actual vs Predicted
    if "LSTM" in results:
        y_t = results["LSTM"]["y_test"][:60]
        y_p = results["LSTM"]["y_pred"][:60]
        axes[1, 0].plot(y_t, label="Actual",    color="#2c3e50", linewidth=2)
        axes[1, 0].plot(y_p, label="Predicted", color="#e74c3c",
                        linestyle="--", linewidth=1.5)
        axes[1, 0].set_title("LSTM — Actual vs Predicted (seconds)")
        axes[1, 0].legend()
        axes[1, 0].set_xlabel("Sample")
        axes[1, 0].set_ylabel("Green Time (seconds)")
        axes[1, 0].set_ylim(5, 65)

    # Chart 5: GRU Actual vs Predicted
    if "GRU" in results:
        y_t = results["GRU"]["y_test"][:60]
        y_p = results["GRU"]["y_pred"][:60]
        axes[1, 1].plot(y_t, label="Actual",    color="#2c3e50", linewidth=2)
        axes[1, 1].plot(y_p, label="Predicted", color="#2ecc71",
                        linestyle="--", linewidth=1.5)
        axes[1, 1].set_title("GRU — Actual vs Predicted (seconds)")
        axes[1, 1].legend()
        axes[1, 1].set_xlabel("Sample")
        axes[1, 1].set_ylabel("Green Time (seconds)")
        axes[1, 1].set_ylim(5, 65)

    # Chart 6: Confusion Matrix
    best_clf_name = None
    best_acc = 0
    for name, m in clf_models.items():
        if m["accuracy"] > best_acc:
            best_acc      = m["accuracy"]
            best_clf_name = name

    if best_clf_name:
        from sklearn.metrics import confusion_matrix
        cm     = confusion_matrix(
            results[best_clf_name]["y_test"],
            results[best_clf_name]["y_pred"]
        )
        # Get labels
        if "le" in results[best_clf_name]:
            labels = results[best_clf_name]["le"].classes_
        else:
            labels = ["HIGH", "LOW", "MEDIUM"]

        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                    ax=axes[1, 2], cbar=False,
                    xticklabels=labels, yticklabels=labels)
        axes[1, 2].set_title(f"{best_clf_name} — Confusion Matrix")
        axes[1, 2].set_xlabel("Predicted")
        axes[1, 2].set_ylabel("Actual")

    plt.tight_layout()
    save_path = save_dir / "model_comparison.png"
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"\nChart saved: {save_path}")
    return str(save_path)


def print_summary(results: dict):
    print("\n" + "="*70)
    print("FINAL MODEL EVALUATION SUMMARY")
    print("="*70)

    reg_models = {k: v for k, v in results.items() if v.get("type") == "regression"}
    clf_models = {k: v for k, v in results.items() if v.get("type") == "classifier"}

    if reg_models:
        print(f"\n📈 Regression Models (Green Time Prediction in Seconds)")
        print(f"{'Model':<14} {'MAE':<12} {'RMSE':<12} {'Status'}")
        print("-"*50)
        best_mae  = min(v["mae"]  for v in reg_models.values())
        best_rmse = min(v["rmse"] for v in reg_models.values())
        for model, m in reg_models.items():
            status = ""
            if m["mae"]  == best_mae:  status += "✓ Best MAE "
            if m["rmse"] == best_rmse: status += "✓ Best RMSE"
            print(f"{model:<14} {m['mae']:<12.2f} {m['rmse']:<12.2f} {status}")

    if clf_models:
        print(f"\n🎯 Classification Models (Traffic Level Prediction)")
        print(f"{'Model':<16} {'Accuracy':<12} {'Status'}")
        print("-"*40)
        best_acc = max(v["accuracy"] for v in clf_models.values())
        for model, m in clf_models.items():
            status = "✓ Best" if m["accuracy"] == best_acc else ""
            print(f"{model:<16} {m['accuracy']*100:<12.2f}% {status}")

    print("="*70)


if __name__ == "__main__":
    print("Starting model evaluation...")
    results = evaluate_all_models()
    print_summary(results)
    plot_comparison(results)
    print("\n✅ Evaluation complete!")