import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import GRU, Dense, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import (
    SEQUENCE_LENGTH, NUM_FEATURES, FEATURES,
    GRU_UNITS, DROPOUT_RATE, EPOCHS, BATCH_SIZE,
    LEARNING_RATE, SAVED_MODELS_DIR,
    MIN_GREEN_TIME, MAX_GREEN_TIME
)

class GRUModelImproved:
    """
    ✅ IMPROVEMENT #3: Custom Loss Function
    Weights predictions based on traffic level importance
    - 10-20s (light): weight=1.0
    - 20-40s (normal): weight=2.0 (most critical)
    - 40-60s (heavy): weight=1.5
    """
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_path = SAVED_MODELS_DIR / "gru_model_improved.keras"
        self.scaler_path = SAVED_MODELS_DIR / "gru_scaler_improved.pkl"
        self.loss_history = None

    # ─── Custom Loss Function ─────────────────────────────────

    @staticmethod
    def weighted_mse_loss(y_true, y_pred):
        """
        Weighted MSE: Penalize errors in critical range (20-40s) more
        - Light traffic (10-20s): less critical, weight=1.0
        - Normal traffic (20-40s): critical, weight=2.0
        - Heavy traffic (40-60s): critical, weight=1.5
        """
        diff = tf.abs(y_true - y_pred)
        
        # Assign weights based on true value
        weights = tf.where(
            y_true < 20, 
            1.0,  # Light traffic
            tf.where(
                y_true < 40,
                2.0,  # Normal traffic (most important)
                1.5   # Heavy traffic
            )
        )
        
        weighted_loss = weights * tf.square(diff)
        return tf.reduce_mean(weighted_loss)

    @staticmethod
    def huber_weighted_loss(y_true, y_pred):
        """Combination: Huber (robust) + Weighted"""
        delta = 5.0  # Huber delta
        diff = y_true - y_pred
        
        # Huber loss
        huber = tf.where(
            tf.abs(diff) < delta,
            0.5 * tf.square(diff),
            delta * (tf.abs(diff) - 0.5 * delta)
        )
        
        # Weights
        weights = tf.where(
            y_true < 20, 1.0,
            tf.where(y_true < 40, 2.0, 1.5)
        )
        
        return tf.reduce_mean(weights * huber)

    def _compute_green_time(self, vehicle_count: float) -> float:
        """Linear mapping: 0 vehicles→10s, 20+→60s"""
        green_range = MAX_GREEN_TIME - MIN_GREEN_TIME
        gt = MIN_GREEN_TIME + (vehicle_count / 20.0) * green_range
        return float(np.clip(gt, MIN_GREEN_TIME, MAX_GREEN_TIME))

    # ─── Build Model ──────────────────────────────────────────

    def build(self, loss_type='weighted'):
        """
        Build GRU with improved architecture
        loss_type: 'weighted', 'huber_weighted', or 'huber'
        """
        model = Sequential([
            GRU(GRU_UNITS, return_sequences=True,
                input_shape=(SEQUENCE_LENGTH, NUM_FEATURES)),
            Dropout(DROPOUT_RATE),
            GRU(GRU_UNITS // 2, return_sequences=False),
            BatchNormalization(),
            Dropout(DROPOUT_RATE),
            Dense(16, activation='relu'),
            Dense(1, activation='linear')
        ])
        
        # Select loss function
        if loss_type == 'weighted':
            loss_fn = self.weighted_mse_loss
        elif loss_type == 'huber_weighted':
            loss_fn = self.huber_weighted_loss
        else:
            loss_fn = 'huber'
        
        model.compile(
            optimizer=Adam(learning_rate=LEARNING_RATE),
            loss=loss_fn,
            metrics=['mae']
        )
        
        self.model = model
        self.loss_type = loss_type
        
        print("✅ GRU Improved model built!")
        print(f"Loss function: {loss_type}")
        print(f"Target: Direct green_time ({MIN_GREEN_TIME}–{MAX_GREEN_TIME}s)")
        model.summary()
        return model

    # ─── Prepare Sequences ────────────────────────────────────

    def prepare_sequences(self, df: pd.DataFrame, shuffle: bool = False):
        """Build sequences with direct green_time targets"""
        from sklearn.preprocessing import MinMaxScaler
        import pickle

        data = df[FEATURES].values
        target = df["vehicle_count"].apply(self._compute_green_time).values

        # Scale features
        self.scaler = MinMaxScaler()
        data_scaled = self.scaler.fit_transform(data)

        with open(self.scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)

        # Build sequences
        X, y = [], []
        for i in range(SEQUENCE_LENGTH, len(data_scaled)):
            X.append(data_scaled[i - SEQUENCE_LENGTH:i])
            y.append(target[i])

        X, y = np.array(X), np.array(y)

        if shuffle:
            idx = np.random.permutation(len(X))
            X, y = X[idx], y[idx]
            print("Data shuffled")

        print(f"Target stats — "
              f"Min: {y.min():.1f}s | "
              f"Max: {y.max():.1f}s | "
              f"Mean: {y.mean():.1f}s | "
              f"Std: {y.std():.1f}s")
        return X, y

    # ─── Train ────────────────────────────────────────────────

    def train(self, df: pd.DataFrame):
        """Train with improved callbacks"""
        if self.model is None:
            self.build(loss_type='huber_weighted')

        X, y = self.prepare_sequences(df, shuffle=True)

        split = int(len(X) * 0.8)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        print(f"Training samples:   {len(X_train)}")
        print(f"Validation samples: {len(X_val)}")

        callbacks = [
            EarlyStopping(patience=20, restore_best_weights=True,
                          monitor='val_mae'),
            ModelCheckpoint(str(self.model_path), save_best_only=True,
                            monitor='val_mae'),
            ReduceLROnPlateau(factor=0.5, patience=10,
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
        print(f"\n✅ GRU Improved saved: {self.model_path}")
        print(f"Best Val MAE: {best_mae:.2f}s")
        self.loss_history = history
        return history

    # ─── Predict ──────────────────────────────────────────────

    def predict(self, sequence: np.ndarray) -> float:
        """Predict green_time (10-60s direct)"""
        if self.model is None:
            self.load()
        seq_scaled = self.scaler.transform(sequence)
        seq_input = seq_scaled.reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)
        pred = self.model.predict(seq_input, verbose=0)[0][0]
        return float(np.clip(pred, MIN_GREEN_TIME, MAX_GREEN_TIME))

    # ─── Load / Evaluate ──────────────────────────────────────

    def load(self):
        """Load trained model"""
        import pickle
        from tensorflow.keras.models import load_model
        self.model = load_model(str(self.model_path),
                                custom_objects={'weighted_mse_loss': self.weighted_mse_loss,
                                                'huber_weighted_loss': self.huber_weighted_loss})
        with open(self.scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        print("✅ GRU Improved model loaded!")

    def evaluate(self, df: pd.DataFrame):
        """Evaluate on test set"""
        from sklearn.metrics import mean_absolute_error, mean_squared_error
        X, y_true = self.prepare_sequences(df, shuffle=False)
        y_pred = self.model.predict(X, verbose=0).flatten()
        y_pred = np.clip(y_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)

        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        
        # Evaluate in ranges
        mask_light = y_true < 20
        mask_normal = (y_true >= 20) & (y_true < 40)
        mask_heavy = y_true >= 40
        
        mae_light = mean_absolute_error(y_true[mask_light], y_pred[mask_light]) if mask_light.sum() > 0 else 0
        mae_normal = mean_absolute_error(y_true[mask_normal], y_pred[mask_normal]) if mask_normal.sum() > 0 else 0
        mae_heavy = mean_absolute_error(y_true[mask_heavy], y_pred[mask_heavy]) if mask_heavy.sum() > 0 else 0
        
        print(f"\n✅ GRU Improved Evaluation:")
        print(f"Overall MAE: {mae:.2f}s | RMSE: {rmse:.2f}s")
        print(f"Light traffic (10-20s) MAE:  {mae_light:.2f}s")
        print(f"Normal traffic (20-40s) MAE: {mae_normal:.2f}s ← MOST IMPORTANT")
        print(f"Heavy traffic (40-60s) MAE:  {mae_heavy:.2f}s")
        
        return {
            "mae": mae, "rmse": rmse,
            "mae_light": mae_light,
            "mae_normal": mae_normal,
            "mae_heavy": mae_heavy,
            "y_true": y_true, "y_pred": y_pred
        }


if __name__ == "__main__":
    gru = GRUModelImproved()
    gru.build(loss_type='huber_weighted')
    print("\nGreen time calculation test:")
    for v in [0, 5, 10, 15, 20, 25]:
        t = gru._compute_green_time(v)
        print(f"  {v} vehicles → {t:.1f}s green time")
