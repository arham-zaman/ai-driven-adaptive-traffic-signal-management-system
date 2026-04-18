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

    # Fill missing feature values
    for col in FEATURES:
        if col not in combined.columns:
            combined[col] = 0.0

    print(f"\nTotal rows: {len(combined)}")
    print(f"Features: {FEATURES}")
    print(f"Sample:\n{combined[FEATURES].head()}")
    return combined

def train_xgboost(df: pd.DataFrame):
    """Train XGBoost baseline model"""
    from xgboost import XGBRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    import pickle

    print("\n" + "="*50)
    print("Training XGBoost baseline...")

    X = df[FEATURES].values
    y = df["vehicle_count"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = XGBRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=6,
        random_state=42,
        verbosity=0
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae  = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    print(f"XGBoost — MAE: {mae:.4f} | RMSE: {rmse:.4f}")

    # Save model
    model_path = SAVED_MODELS_DIR / "xgboost_model.pkl"
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"XGBoost saved: {model_path}")

    return {"mae": mae, "rmse": rmse}

def train_lstm(df: pd.DataFrame):
    """Train LSTM model"""
    print("\n" + "="*50)
    print("Training LSTM...")

    lstm = LSTMModel()
    lstm.build()
    history = lstm.train(df)

    # Final metrics
    final_mae  = min(history.history['val_mae'])
    final_loss = min(history.history['val_loss'])
    print(f"LSTM — Best Val MAE: {final_mae:.4f} | Best Val Loss: {final_loss:.4f}")

    return {"mae": final_mae, "loss": final_loss}

def train_gru(df: pd.DataFrame):
    """Train GRU model"""
    print("\n" + "="*50)
    print("Training GRU...")

    gru = GRUModel()
    gru.build()
    history = gru.train(df)

    final_mae  = min(history.history['val_mae'])
    final_loss = min(history.history['val_loss'])
    print(f"GRU — Best Val MAE: {final_mae:.4f} | Best Val Loss: {final_loss:.4f}")

    return {"mae": final_mae, "loss": final_loss}

def compare_models(results: dict):
    """Print comparison table"""
    print("\n" + "="*50)
    print("MODEL COMPARISON")
    print("="*50)
    print(f"{'Model':<12} {'MAE':<12} {'RMSE/Loss':<12}")
    print("-"*36)
    for model_name, metrics in results.items():
        mae  = metrics.get('mae', 'N/A')
        rmse = metrics.get('rmse', metrics.get('loss', 'N/A'))
        if isinstance(mae, float):
            mae  = f"{mae:.4f}"
            rmse = f"{rmse:.4f}" if isinstance(rmse, float) else rmse
        print(f"{model_name:<12} {mae:<12} {rmse:<12}")
    print("="*50)
    print("Lower MAE = Better model!")

if __name__ == "__main__":
    # Load data
    df = load_all_data()

    results = {}

    # Train all models
    results["XGBoost"] = train_xgboost(df)
    results["LSTM"]    = train_lstm(df)
    results["GRU"]     = train_gru(df)

    # Compare
    compare_models(results)

    print("\nAll models trained and saved!")
    print(f"Models in: {SAVED_MODELS_DIR}")