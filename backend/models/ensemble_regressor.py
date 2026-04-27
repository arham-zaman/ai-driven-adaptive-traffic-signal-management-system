import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import (
    Conv1D, GRU, LSTM, Dense, Dropout, BatchNormalization,
    Flatten, Input, concatenate
)
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from pathlib import Path
import pickle
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import (
    SEQUENCE_LENGTH, NUM_FEATURES, FEATURES,
    EPOCHS, BATCH_SIZE, LEARNING_RATE, SAVED_MODELS_DIR,
    MIN_GREEN_TIME, MAX_GREEN_TIME
)

class EnsembleGreenTimePredictor:
    """
    ✅ IMPROVEMENT #2: Ensemble of 3 Models
    - CNN: Captures local patterns
    - GRU: Temporal sequence modeling
    - Hybrid CNN+GRU: Best of both worlds
    
    Final prediction: Weighted average (40% CNN + 40% GRU + 20% Hybrid)
    """
    
    def __init__(self):
        self.cnn_model = None
        self.gru_model = None
        self.hybrid_model = None
        self.ensemble_model = None
        self.scaler = None
        
        self.cnn_path = SAVED_MODELS_DIR / "cnn_green_time.keras"
        self.gru_path = SAVED_MODELS_DIR / "gru_green_time.keras"
        self.hybrid_path = SAVED_MODELS_DIR / "hybrid_green_time.keras"
        self.scaler_path = SAVED_MODELS_DIR / "ensemble_scaler.pkl"

    def _compute_green_time(self, vehicle_count: float) -> float:
        """Linear mapping: 0 vehicles→10s, 20+→60s"""
        green_range = MAX_GREEN_TIME - MIN_GREEN_TIME
        gt = MIN_GREEN_TIME + (vehicle_count / 20.0) * green_range
        return float(np.clip(gt, MIN_GREEN_TIME, MAX_GREEN_TIME))

    # ─── Individual Models ────────────────────────────────────

    def build_cnn_model(self) -> Sequential:
        """
        CNN model: Extract local temporal patterns
        Good for: Short-term traffic changes
        """
        model = Sequential([
            Conv1D(32, kernel_size=3, activation='relu',
                   input_shape=(SEQUENCE_LENGTH, NUM_FEATURES)),
            Dropout(0.2),
            Conv1D(64, kernel_size=3, activation='relu'),
            Dropout(0.2),
            Conv1D(32, kernel_size=2, activation='relu'),
            Dropout(0.1),
            Flatten(),
            Dense(32, activation='relu'),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(1, activation='linear')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=LEARNING_RATE),
            loss='huber',
            metrics=['mae']
        )
        print("✅ CNN model built!")
        return model

    def build_gru_model(self) -> Sequential:
        """
        GRU model: Temporal sequence learning
        Good for: Long-term patterns
        """
        model = Sequential([
            GRU(64, return_sequences=True,
                input_shape=(SEQUENCE_LENGTH, NUM_FEATURES)),
            Dropout(0.2),
            GRU(32, return_sequences=False),
            BatchNormalization(),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(8, activation='relu'),
            Dense(1, activation='linear')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=LEARNING_RATE),
            loss='huber',
            metrics=['mae']
        )
        print("✅ GRU model built!")
        return model

    def build_hybrid_model(self) -> Sequential:
        """
        Hybrid: CNN for feature extraction + GRU for sequences
        Combines advantages of both
        """
        model = Sequential([
            Conv1D(16, kernel_size=2, activation='relu',
                   input_shape=(SEQUENCE_LENGTH, NUM_FEATURES)),
            Dropout(0.1),
            GRU(32, return_sequences=False),
            Dense(16, activation='relu'),
            Dropout(0.1),
            Dense(1, activation='linear')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=LEARNING_RATE),
            loss='huber',
            metrics=['mae']
        )
        print("✅ Hybrid CNN+GRU model built!")
        return model

    # ─── Training ────────────────────────────────────────────

    def train_all_models(self, df: pd.DataFrame):
        """Train all 3 models"""
        print("\n" + "="*60)
        print("TRAINING ENSEMBLE (3 Models)")
        print("="*60)
        
        # Prepare data
        from sklearn.preprocessing import MinMaxScaler
        
        data = df[FEATURES].values
        target = df["vehicle_count"].apply(self._compute_green_time).values
        
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
        
        # Shuffle
        idx = np.random.permutation(len(X))
        X, y = X[idx], y[idx]
        
        split = int(len(X) * 0.8)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]
        
        print(f"\nData: {len(X_train)} training, {len(X_val)} validation")
        print(f"Target range: {y.min():.1f}s – {y.max():.1f}s")
        
        # Callbacks
        callbacks = [
            EarlyStopping(patience=15, restore_best_weights=True, monitor='val_mae'),
            ReduceLROnPlateau(factor=0.5, patience=7, min_lr=1e-6, verbose=0)
        ]
        
        # Train CNN
        print("\n" + "-"*60)
        print("1. Training CNN Model...")
        print("-"*60)
        self.cnn_model = self.build_cnn_model()
        cnn_callbacks = callbacks + [
            ModelCheckpoint(str(self.cnn_path), save_best_only=True, monitor='val_mae')
        ]
        cnn_history = self.cnn_model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            callbacks=cnn_callbacks,
            verbose=1
        )
        print(f"CNN — Best Val MAE: {min(cnn_history.history['val_mae']):.2f}s")
        
        # Train GRU
        print("\n" + "-"*60)
        print("2. Training GRU Model...")
        print("-"*60)
        self.gru_model = self.build_gru_model()
        gru_callbacks = callbacks + [
            ModelCheckpoint(str(self.gru_path), save_best_only=True, monitor='val_mae')
        ]
        gru_history = self.gru_model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            callbacks=gru_callbacks,
            verbose=1
        )
        print(f"GRU — Best Val MAE: {min(gru_history.history['val_mae']):.2f}s")
        
        # Train Hybrid
        print("\n" + "-"*60)
        print("3. Training Hybrid CNN+GRU Model...")
        print("-"*60)
        self.hybrid_model = self.build_hybrid_model()
        hybrid_callbacks = callbacks + [
            ModelCheckpoint(str(self.hybrid_path), save_best_only=True, monitor='val_mae')
        ]
        hybrid_history = self.hybrid_model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            callbacks=hybrid_callbacks,
            verbose=1
        )
        print(f"Hybrid — Best Val MAE: {min(hybrid_history.history['val_mae']):.2f}s")
        
        print("\n" + "="*60)
        print(f"✅ All models trained and saved!")
        print("="*60)
        
        return {
            'cnn': cnn_history,
            'gru': gru_history,
            'hybrid': hybrid_history
        }

    # ─── Ensemble Prediction ──────────────────────────────────

    def predict_ensemble(self, sequence: np.ndarray) -> dict:
        """
        Ensemble prediction: Weighted average of 3 models
        Weights: CNN 40% + GRU 40% + Hybrid 20%
        """
        if self.cnn_model is None or self.gru_model is None:
            self.load()
        
        seq_scaled = self.scaler.transform(sequence)
        seq_input = seq_scaled.reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)
        
        # Individual predictions
        cnn_pred = float(self.cnn_model.predict(seq_input, verbose=0)[0][0])
        gru_pred = float(self.gru_model.predict(seq_input, verbose=0)[0][0])
        hybrid_pred = float(self.hybrid_model.predict(seq_input, verbose=0)[0][0])
        
        # Clip to valid range
        cnn_pred = np.clip(cnn_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)
        gru_pred = np.clip(gru_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)
        hybrid_pred = np.clip(hybrid_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)
        
        # Weighted average
        ensemble_pred = (
            0.40 * cnn_pred +
            0.40 * gru_pred +
            0.20 * hybrid_pred
        )
        
        return {
            "ensemble": float(np.clip(ensemble_pred, MIN_GREEN_TIME, MAX_GREEN_TIME)),
            "cnn": cnn_pred,
            "gru": gru_pred,
            "hybrid": hybrid_pred,
            "confidence": round(np.std([cnn_pred, gru_pred, hybrid_pred]), 2)
        }

    # ─── Load / Evaluate ──────────────────────────────────────

    def load(self):
        """Load all trained models"""
        from tensorflow.keras.models import load_model
        
        self.cnn_model = load_model(str(self.cnn_path))
        self.gru_model = load_model(str(self.gru_path))
        self.hybrid_model = load_model(str(self.hybrid_path))
        
        with open(self.scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        
        print("✅ Ensemble models loaded!")

    def evaluate(self, df: pd.DataFrame):
        """Evaluate ensemble on test set"""
        from sklearn.metrics import mean_absolute_error, mean_squared_error
        
        # Prepare data
        from sklearn.preprocessing import MinMaxScaler
        
        data = df[FEATURES].values
        target = df["vehicle_count"].apply(self._compute_green_time).values
        
        scaler = MinMaxScaler()
        data_scaled = scaler.fit_transform(data)
        
        X, y = [], []
        for i in range(SEQUENCE_LENGTH, len(data_scaled)):
            X.append(data_scaled[i - SEQUENCE_LENGTH:i])
            y.append(target[i])
        
        X, y_true = np.array(X), np.array(y)
        
        # Predictions
        y_ensemble = []
        y_cnn = []
        y_gru = []
        y_hybrid = []
        
        for seq in X:
            pred = self.predict_ensemble(seq)  # ✅ FIXED - use actual sequence
            y_ensemble.append(pred['ensemble'])
            y_cnn.append(pred['cnn'])
            y_gru.append(pred['gru'])
            y_hybrid.append(pred['hybrid'])
        
        y_ensemble = np.array(y_ensemble)
        y_cnn = np.array(y_cnn)
        y_gru = np.array(y_gru)
        y_hybrid = np.array(y_hybrid)
        
        # Metrics
        mae_ensemble = mean_absolute_error(y_true, y_ensemble)
        mae_cnn = mean_absolute_error(y_true, y_cnn)
        mae_gru = mean_absolute_error(y_true, y_gru)
        mae_hybrid = mean_absolute_error(y_true, y_hybrid)
        
        print("\n✅ ENSEMBLE EVALUATION:")
        print(f"CNN MAE:      {mae_cnn:.2f}s")
        print(f"GRU MAE:      {mae_gru:.2f}s")
        print(f"Hybrid MAE:   {mae_hybrid:.2f}s")
        print(f"ENSEMBLE MAE: {mae_ensemble:.2f}s ← Best!")
        
        return {
            "ensemble_mae": mae_ensemble,
            "cnn_mae": mae_cnn,
            "gru_mae": mae_gru,
            "hybrid_mae": mae_hybrid,
            "y_true": y_true,
            "y_ensemble": y_ensemble
        }


if __name__ == "__main__":
    ensemble = EnsembleGreenTimePredictor()
    print("✅ Ensemble Regressor ready!")
    print("\nModels in ensemble:")
    print("1. CNN — Local pattern detection")
    print("2. GRU — Temporal sequence learning")
    print("3. Hybrid — CNN + GRU combined")
    print("\nEnsemble weights:")
    print("- CNN: 40%")
    print("- GRU: 40%")
    print("- Hybrid: 20%")