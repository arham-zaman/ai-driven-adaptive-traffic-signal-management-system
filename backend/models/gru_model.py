import numpy as np
import pandas as pd
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import (
    SEQUENCE_LENGTH, NUM_FEATURES, FEATURES,
    GRU_UNITS, DROPOUT_RATE, EPOCHS, BATCH_SIZE,
    LEARNING_RATE, SAVED_MODELS_DIR,
    MIN_GREEN_TIME, MAX_GREEN_TIME
)

class GRUModel:
    def __init__(self):
        self.model       = None
        self.scaler      = None
        self.model_path  = SAVED_MODELS_DIR / "gru_model.keras"
        self.scaler_path = SAVED_MODELS_DIR / "gru_scaler.pkl"

    # ─── Target helper ────────────────────────────────────────

    def _compute_green_time(self, vehicle_count: float) -> float:
        """Linear mapping: 0 vehicles→10s, 20+→60s"""
        green_range = MAX_GREEN_TIME - MIN_GREEN_TIME  # 50
        gt = MIN_GREEN_TIME + (vehicle_count / 20.0) * green_range
        return float(np.clip(gt, MIN_GREEN_TIME, MAX_GREEN_TIME))

    # ─── Build ────────────────────────────────────────────────

    def build(self):
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import (
            GRU, Dense, Dropout, BatchNormalization
        )
        from tensorflow.keras.optimizers import Adam

        model = Sequential([
            GRU(GRU_UNITS, return_sequences=True,
                input_shape=(SEQUENCE_LENGTH, NUM_FEATURES)),
            Dropout(DROPOUT_RATE),
            GRU(GRU_UNITS // 2, return_sequences=False),
            BatchNormalization(),
            Dropout(DROPOUT_RATE),
            Dense(16, activation='relu'),
            Dense(1, activation='linear')  # ✅ Direct green_time (10-60s)
        ])

        model.compile(
            optimizer=Adam(learning_rate=LEARNING_RATE),
            loss='huber',    # ✅ Robust to outliers
            metrics=['mae']
        )
        self.model = model
        print("GRU model built!")
        print(f"Target: Direct green_time ({MIN_GREEN_TIME}–{MAX_GREEN_TIME}s)")
        print("Loss: Huber (robust to outliers)")
        model.summary()
        return model

    # ─── Prepare Sequences ────────────────────────────────────

    def prepare_sequences(self, df: pd.DataFrame, shuffle: bool = False):
        """
        Build sequences with direct green_time targets.
        NO normalization — model predicts 10-60 directly.
        """
        from sklearn.preprocessing import MinMaxScaler
        import pickle

        data   = df[FEATURES].values
        target = df["vehicle_count"].apply(
            self._compute_green_time
        ).values

        # ── Scale features only ────────────────────────────────
        self.scaler    = MinMaxScaler()
        data_scaled    = self.scaler.fit_transform(data)

        with open(self.scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)

        # ── Build sequences ───────────────────────────────────
        X, y = [], []
        for i in range(SEQUENCE_LENGTH, len(data_scaled)):
            X.append(data_scaled[i - SEQUENCE_LENGTH:i])
            y.append(target[i])  # ✅ Direct green_time value

        X, y = np.array(X), np.array(y)

        # ── Shuffle ────────────────────────────────────────────
        if shuffle:
            idx = np.random.permutation(len(X))
            X, y = X[idx], y[idx]
            print("Data shuffled — time-order bias removed")

        print(f"Target stats — "
              f"Min: {y.min():.1f}s | "
              f"Max: {y.max():.1f}s | "
              f"Mean: {y.mean():.1f}s | "
              f"Std: {y.std():.1f}s")
        return X, y

    # ─── Train ────────────────────────────────────────────────

    def train(self, df: pd.DataFrame):
        from tensorflow.keras.callbacks import (
            EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
        )

        if self.model is None:
            self.build()

        X, y = self.prepare_sequences(df, shuffle=True)

        split          = int(len(X) * 0.8)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        print(f"Training samples:   {len(X_train)}")
        print(f"Validation samples: {len(X_val)}")

        callbacks = [
            EarlyStopping(patience=15, restore_best_weights=True,
                          monitor='val_mae'),
            ModelCheckpoint(str(self.model_path), save_best_only=True,
                            monitor='val_mae'),
            ReduceLROnPlateau(factor=0.5, patience=7,
                              min_lr=1e-6, verbose=1)
        ]

        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            callbacks=callbacks,
            verbose=1
        )

        best_mae = min(history.history['val_mae'])
        print(f"GRU saved: {self.model_path}")
        print(f"Best Val MAE: {best_mae:.2f}s")
        return history

    # ─── Predict ──────────────────────────────────────────────

    def predict(self, sequence: np.ndarray) -> float:
        """Predict green_time in seconds (10-60s direct)"""
        if self.model is None:
            self.load()
        seq_scaled = self.scaler.transform(sequence)
        seq_input  = seq_scaled.reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)
        pred       = self.model.predict(seq_input, verbose=0)[0][0]
        return float(np.clip(pred, MIN_GREEN_TIME, MAX_GREEN_TIME))

    # ─── Load / Evaluate ──────────────────────────────────────

    def load(self):
        import pickle
        from tensorflow.keras.models import load_model
        self.model = load_model(str(self.model_path))
        with open(self.scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        print("GRU model loaded!")

    def evaluate(self, df: pd.DataFrame):
        from sklearn.metrics import mean_absolute_error, mean_squared_error
        X, y_true = self.prepare_sequences(df, shuffle=False)
        y_pred = self.model.predict(X, verbose=0).flatten()
        y_pred = np.clip(y_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)

        mae  = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        print(f"GRU — MAE: {mae:.2f}s | RMSE: {rmse:.2f}s")
        return {"mae": mae, "rmse": rmse, "y_true": y_true, "y_pred": y_pred}


if __name__ == "__main__":
    gru = GRUModel()
    gru.build()
    print("\nGreen time calculation test:")
    for v in [0, 5, 10, 15, 20, 25]:
        t = gru._compute_green_time(v)
        print(f"  {v} vehicles → {t:.1f}s green time")