import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import PROCESSED_DIR, SAVED_MODELS_DIR, FEATURES

def load_data():
    """Load all processed CSV files"""
    dfs = []
    for csv_file in PROCESSED_DIR.glob("*.csv"):
        df = pd.read_csv(csv_file)
        dfs.append(df)
    return pd.concat(dfs, ignore_index=True)

def evaluate_all_models():
    """Evaluate and compare all 3 models"""
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error

    df = load_data()
    print(f"Total data: {len(df)} rows")

    X = df[FEATURES].values
    y = df["vehicle_count"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    results = {}

    # ── XGBoost ───────────────────────────────────────────────
    print("\nEvaluating XGBoost...")
    from backend.models.xgboost_model import XGBoostModel
    xgb = XGBoostModel()
    xgb.load()
    y_pred_xgb = xgb.model.predict(X_test)
    results["XGBoost"] = {
        "mae":  mean_absolute_error(y_test, y_pred_xgb),
        "rmse": np.sqrt(mean_squared_error(y_test, y_pred_xgb)),
        "y_pred": y_pred_xgb
    }

    # ── LSTM ──────────────────────────────────────────────────
    print("Evaluating LSTM...")
    from backend.models.lstm_model import LSTMModel
    lstm = LSTMModel()
    lstm.load()
    X_seq, y_seq = lstm.prepare_sequences(df)
    _, X_test_seq, _, y_test_seq = train_test_split(
        X_seq, y_seq, test_size=0.2, random_state=42
    )
    y_pred_lstm = lstm.model.predict(X_test_seq, verbose=0).flatten()
    results["LSTM"] = {
        "mae":  mean_absolute_error(y_test_seq, y_pred_lstm),
        "rmse": np.sqrt(mean_squared_error(y_test_seq, y_pred_lstm)),
        "y_pred": y_pred_lstm,
        "y_test": y_test_seq
    }

    # ── GRU ───────────────────────────────────────────────────
    print("Evaluating GRU...")
    from backend.models.gru_model import GRUModel
    gru = GRUModel()
    gru.load()
    X_seq_g, y_seq_g = gru.prepare_sequences(df)
    _, X_test_g, _, y_test_g = train_test_split(
        X_seq_g, y_seq_g, test_size=0.2, random_state=42
    )
    y_pred_gru = gru.model.predict(X_test_g, verbose=0).flatten()
    results["GRU"] = {
        "mae":  mean_absolute_error(y_test_g, y_pred_gru),
        "rmse": np.sqrt(mean_squared_error(y_test_g, y_pred_gru)),
        "y_pred": y_pred_gru,
        "y_test": y_test_g
    }

    return results, y_test

def plot_comparison(results):
    """Generate comparison charts — for FYP report"""
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("AI Traffic Signal — Model Comparison", fontsize=16)

    models = list(results.keys())
    maes   = [results[m]["mae"]  for m in models]
    rmses  = [results[m]["rmse"] for m in models]
    colors = ["#3498db", "#e74c3c", "#2ecc71"]

    # ── Chart 1: MAE Comparison ───────────────────────────────
    axes[0,0].bar(models, maes, color=colors)
    axes[0,0].set_title("MAE Comparison (Lower = Better)")
    axes[0,0].set_ylabel("Mean Absolute Error")
    for i, v in enumerate(maes):
        axes[0,0].text(i, v + 0.01, f"{v:.4f}", ha='center', fontsize=10)

    # ── Chart 2: RMSE Comparison ──────────────────────────────
    axes[0,1].bar(models, rmses, color=colors)
    axes[0,1].set_title("RMSE Comparison (Lower = Better)")
    axes[0,1].set_ylabel("Root Mean Square Error")
    for i, v in enumerate(rmses):
        axes[0,1].text(i, v + 0.01, f"{v:.4f}", ha='center', fontsize=10)

    # ── Chart 3: LSTM Predictions vs Actual ──────────────────
    y_test_lstm = results["LSTM"]["y_test"]
    y_pred_lstm = results["LSTM"]["y_pred"]
    axes[1,0].plot(y_test_lstm[:50], label="Actual",    color="#2c3e50")
    axes[1,0].plot(y_pred_lstm[:50], label="Predicted", color="#e74c3c",
                   linestyle="--")
    axes[1,0].set_title("LSTM — Actual vs Predicted")
    axes[1,0].legend()
    axes[1,0].set_xlabel("Sample")
    axes[1,0].set_ylabel("Vehicle Count")

    # ── Chart 4: GRU Predictions vs Actual ───────────────────
    y_test_gru = results["GRU"]["y_test"]
    y_pred_gru = results["GRU"]["y_pred"]
    axes[1,1].plot(y_test_gru[:50], label="Actual",    color="#2c3e50")
    axes[1,1].plot(y_pred_gru[:50], label="Predicted", color="#2ecc71",
                   linestyle="--")
    axes[1,1].set_title("GRU — Actual vs Predicted")
    axes[1,1].legend()
    axes[1,1].set_xlabel("Sample")
    axes[1,1].set_ylabel("Vehicle Count")

    plt.tight_layout()
    save_path = SAVED_MODELS_DIR / "model_comparison.png"
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    print(f"\nChart saved: {save_path}")
    plt.show()

def print_summary(results):
    """Print final comparison table"""
    print("\n" + "="*55)
    print("FINAL MODEL COMPARISON")
    print("="*55)
    print(f"{'Model':<12} {'MAE':<15} {'RMSE':<15} {'Winner'}")
    print("-"*55)

    best_mae  = min(results[m]["mae"]  for m in results)
    best_rmse = min(results[m]["rmse"] for m in results)

    for model, metrics in results.items():
        mae_str  = f"{metrics['mae']:.4f}"
        rmse_str = f"{metrics['rmse']:.4f}"
        winner   = ""
        if metrics["mae"] == best_mae:
            winner += "MAE ✓ "
        if metrics["rmse"] == best_rmse:
            winner += "RMSE ✓"
        print(f"{model:<12} {mae_str:<15} {rmse_str:<15} {winner}")
    print("="*55)


if __name__ == "__main__":
    print("Starting model evaluation...")
    results, y_test = evaluate_all_models()
    print_summary(results)
    plot_comparison(results)
    print("\nEvaluation complete!")