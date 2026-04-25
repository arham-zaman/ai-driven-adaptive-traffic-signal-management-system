import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # non-interactive backend — works without display
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import PROCESSED_DIR, SAVED_MODELS_DIR, FEATURES

sns.set_theme(style="whitegrid")
COLORS = ["#3498db", "#e74c3c", "#2ecc71"]


def load_data():
    dfs = []
    for csv_file in PROCESSED_DIR.glob("*.csv"):
        df = pd.read_csv(csv_file)
        dfs.append(df)
    if not dfs:
        raise FileNotFoundError(f"No CSV files found in {PROCESSED_DIR}")
    return pd.concat(dfs, ignore_index=True)


def evaluate_all_models():
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error

    df = load_data()
    print(f"Total data: {len(df)} rows")

    results = {}

    # ── XGBoost Classifier ────────────────────────────────────
    print("\nEvaluating XGBoost Classifier...")
    try:
        from backend.models.xgboost_classifier import XGBoostClassifier
        CLASSIFIER_FEATURES = ["queue_length", "avg_speed", "density", "count_change"]
        xgb = XGBoostClassifier()
        xgb.load()
        X_clf = df[CLASSIFIER_FEATURES].values
        y_clf_raw = df["vehicle_count"].apply(
            lambda x: "LOW" if x <= 5 else "MEDIUM" if x <= 15 else "HIGH"
        ).values
        y_clf_enc = xgb.le.transform(y_clf_raw)
        X_clf_scaled = xgb.scaler.transform(X_clf)
        _, X_test_clf, _, y_test_clf = train_test_split(
            X_clf_scaled, y_clf_enc, test_size=0.2, random_state=42
        )
        y_pred_xgb = xgb.model.predict(X_test_clf)
        from sklearn.metrics import accuracy_score
        acc_xgb = accuracy_score(y_test_clf, y_pred_xgb)
        results["XGBoost"] = {
            "accuracy": acc_xgb,
            "y_pred":   y_pred_xgb,
            "y_test":   y_test_clf,
            "type":     "classifier"
        }
        print(f"XGBoost Accuracy: {acc_xgb*100:.2f}%")
    except Exception as e:
        print(f"XGBoost eval failed: {e}")

    # ── Random Forest Classifier ──────────────────────────────
    print("Evaluating Random Forest Classifier...")
    try:
        from backend.models.rf_classifier import TrafficClassifier, CLASSIFIER_FEATURES
        rf = TrafficClassifier()
        rf.load()
        X_rf = df[CLASSIFIER_FEATURES].values
        y_rf = df["vehicle_count"].apply(
            lambda x: "LOW" if x <= 5 else "MEDIUM" if x <= 15 else "HIGH"
        ).values
        X_rf_scaled = rf.scaler.transform(X_rf)
        _, X_test_rf, _, y_test_rf = train_test_split(
            X_rf_scaled, y_rf, test_size=0.2, random_state=42
        )
        y_pred_rf = rf.model.predict(X_test_rf)
        from sklearn.metrics import accuracy_score
        acc_rf = accuracy_score(y_test_rf, y_pred_rf)
        results["RandomForest"] = {
            "accuracy": acc_rf,
            "y_pred":   y_pred_rf,
            "y_test":   y_test_rf,
            "type":     "classifier"
        }
        print(f"Random Forest Accuracy: {acc_rf*100:.2f}%")
    except Exception as e:
        print(f"RF eval failed: {e}")

    # ── LSTM ──────────────────────────────────────────────────
    print("Evaluating LSTM...")
    try:
        from backend.models.lstm_model import LSTMModel
        lstm = LSTMModel()
        lstm.load()
        X_seq, y_seq = lstm.prepare_sequences(df)
        _, X_test_seq, _, y_test_seq = train_test_split(
            X_seq, y_seq, test_size=0.2, random_state=42
        )
        y_pred_lstm = lstm.model.predict(X_test_seq, verbose=0).flatten()
        mae_lstm  = mean_absolute_error(y_test_seq, y_pred_lstm)
        rmse_lstm = np.sqrt(mean_squared_error(y_test_seq, y_pred_lstm))
        results["LSTM"] = {
            "mae": mae_lstm, "rmse": rmse_lstm,
            "y_pred": y_pred_lstm, "y_test": y_test_seq,
            "type": "regression"
        }
        print(f"LSTM — MAE: {mae_lstm:.4f} | RMSE: {rmse_lstm:.4f}")
    except Exception as e:
        print(f"LSTM eval failed: {e}")

    # ── GRU ───────────────────────────────────────────────────
    print("Evaluating GRU...")
    try:
        from backend.models.gru_model import GRUModel
        gru = GRUModel()
        gru.load()
        X_seq_g, y_seq_g = gru.prepare_sequences(df)
        _, X_test_g, _, y_test_g = train_test_split(
            X_seq_g, y_seq_g, test_size=0.2, random_state=42
        )
        y_pred_gru = gru.model.predict(X_test_g, verbose=0).flatten()
        mae_gru  = mean_absolute_error(y_test_g, y_pred_gru)
        rmse_gru = np.sqrt(mean_squared_error(y_test_g, y_pred_gru))
        results["GRU"] = {
            "mae": mae_gru, "rmse": rmse_gru,
            "y_pred": y_pred_gru, "y_test": y_test_g,
            "type": "regression"
        }
        print(f"GRU — MAE: {mae_gru:.4f} | RMSE: {rmse_gru:.4f}")
    except Exception as e:
        print(f"GRU eval failed: {e}")

    return results


def plot_comparison(results: dict):
    """Generate and SAVE all comparison charts"""
    save_dir = SAVED_MODELS_DIR
    save_dir.mkdir(parents=True, exist_ok=True)

    reg_models = {k: v for k, v in results.items() if v.get("type") == "regression"}
    clf_models = {k: v for k, v in results.items() if v.get("type") == "classifier"}

    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle("AI Traffic Signal — Model Evaluation", fontsize=16, fontweight='bold')

    # ── Chart 1: MAE Comparison (Regression) ──────────────────
    if reg_models:
        names = list(reg_models.keys())
        maes  = [reg_models[m]["mae"] for m in names]
        bars  = axes[0, 0].bar(names, maes, color=COLORS[:len(names)])
        axes[0, 0].set_title("Regression — MAE Comparison\n(Lower = Better)")
        axes[0, 0].set_ylabel("Mean Absolute Error")
        for bar, val in zip(bars, maes):
            axes[0, 0].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.001,
                f"{val:.4f}", ha='center', fontsize=10, fontweight='bold'
            )
    else:
        axes[0, 0].text(0.5, 0.5, "No regression\nresults",
                        ha='center', va='center', transform=axes[0, 0].transAxes)

    # ── Chart 2: RMSE Comparison (Regression) ─────────────────
    if reg_models:
        names  = list(reg_models.keys())
        rmses  = [reg_models[m]["rmse"] for m in names]
        bars   = axes[0, 1].bar(names, rmses, color=COLORS[:len(names)])
        axes[0, 1].set_title("Regression — RMSE Comparison\n(Lower = Better)")
        axes[0, 1].set_ylabel("Root Mean Square Error")
        for bar, val in zip(bars, rmses):
            axes[0, 1].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.001,
                f"{val:.4f}", ha='center', fontsize=10, fontweight='bold'
            )
    else:
        axes[0, 1].text(0.5, 0.5, "No regression\nresults",
                        ha='center', va='center', transform=axes[0, 1].transAxes)

    # ── Chart 3: Accuracy Comparison (Classifiers) ────────────
    if clf_models:
        names = list(clf_models.keys())
        accs  = [clf_models[m]["accuracy"] * 100 for m in names]
        bars  = axes[0, 2].bar(names, accs, color=["#9b59b6", "#f39c12"][:len(names)])
        axes[0, 2].set_title("Classification — Accuracy\n(Higher = Better)")
        axes[0, 2].set_ylabel("Accuracy (%)")
        axes[0, 2].set_ylim(0, 110)
        for bar, val in zip(bars, accs):
            axes[0, 2].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.5,
                f"{val:.2f}%", ha='center', fontsize=10, fontweight='bold'
            )
    else:
        axes[0, 2].text(0.5, 0.5, "No classifier\nresults",
                        ha='center', va='center', transform=axes[0, 2].transAxes)

    # ── Chart 4: LSTM Actual vs Predicted ─────────────────────
    if "LSTM" in results:
        y_t = results["LSTM"]["y_test"][:60]
        y_p = results["LSTM"]["y_pred"][:60]
        axes[1, 0].plot(y_t, label="Actual",    color="#2c3e50", linewidth=2)
        axes[1, 0].plot(y_p, label="Predicted", color="#e74c3c",
                        linestyle="--", linewidth=1.5)
        axes[1, 0].set_title("LSTM — Actual vs Predicted")
        axes[1, 0].legend()
        axes[1, 0].set_xlabel("Sample")
        axes[1, 0].set_ylabel("Vehicle Count")
    else:
        axes[1, 0].text(0.5, 0.5, "LSTM not available",
                        ha='center', va='center', transform=axes[1, 0].transAxes)

    # ── Chart 5: GRU Actual vs Predicted ──────────────────────
    if "GRU" in results:
        y_t = results["GRU"]["y_test"][:60]
        y_p = results["GRU"]["y_pred"][:60]
        axes[1, 1].plot(y_t, label="Actual",    color="#2c3e50", linewidth=2)
        axes[1, 1].plot(y_p, label="Predicted", color="#2ecc71",
                        linestyle="--", linewidth=1.5)
        axes[1, 1].set_title("GRU — Actual vs Predicted")
        axes[1, 1].legend()
        axes[1, 1].set_xlabel("Sample")
        axes[1, 1].set_ylabel("Vehicle Count")
    else:
        axes[1, 1].text(0.5, 0.5, "GRU not available",
                        ha='center', va='center', transform=axes[1, 1].transAxes)

    # ── Chart 6: Confusion Matrix for best classifier ─────────
    best_clf_name = None
    best_acc = 0
    for name, m in clf_models.items():
        if m["accuracy"] > best_acc:
            best_acc = m["accuracy"]
            best_clf_name = name

    if best_clf_name:
        from sklearn.metrics import confusion_matrix
        cm = confusion_matrix(
            results[best_clf_name]["y_test"],
            results[best_clf_name]["y_pred"]
        )
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                    ax=axes[1, 2], cbar=False)
        axes[1, 2].set_title(f"{best_clf_name} — Confusion Matrix")
        axes[1, 2].set_xlabel("Predicted")
        axes[1, 2].set_ylabel("Actual")
    else:
        axes[1, 2].text(0.5, 0.5, "No classifier\nfor confusion matrix",
                        ha='center', va='center', transform=axes[1, 2].transAxes)

    plt.tight_layout()
    save_path = save_dir / "model_comparison.png"
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"\nChart saved: {save_path}")
    return str(save_path)


def print_summary(results: dict):
    print("\n" + "="*65)
    print("FINAL MODEL COMPARISON")
    print("="*65)

    reg_models = {k: v for k, v in results.items() if v.get("type") == "regression"}
    clf_models = {k: v for k, v in results.items() if v.get("type") == "classifier"}

    if reg_models:
        print(f"\n{'Regression Models'}")
        print(f"{'Model':<14} {'MAE':<12} {'RMSE':<12} {'Winner'}")
        print("-"*50)
        best_mae  = min(v["mae"]  for v in reg_models.values())
        best_rmse = min(v["rmse"] for v in reg_models.values())
        for model, m in reg_models.items():
            winner = ""
            if m["mae"]  == best_mae:  winner += "MAE ✓ "
            if m["rmse"] == best_rmse: winner += "RMSE ✓"
            print(f"{model:<14} {m['mae']:<12.4f} {m['rmse']:<12.4f} {winner}")

    if clf_models:
        print(f"\n{'Classification Models'}")
        print(f"{'Model':<16} {'Accuracy':<12} {'Winner'}")
        print("-"*40)
        best_acc = max(v["accuracy"] for v in clf_models.values())
        for model, m in clf_models.items():
            winner = "ACC ✓" if m["accuracy"] == best_acc else ""
            print(f"{model:<16} {m['accuracy']*100:<12.2f}% {winner}")

    print("="*65)


if __name__ == "__main__":
    print("Starting model evaluation...")
    results = evaluate_all_models()
    print_summary(results)
    plot_comparison(results)
    print("\nEvaluation complete!")