import numpy as np
import pandas as pd
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import (
    SEQUENCE_LENGTH, NUM_FEATURES, FEATURES,
    GRU_UNITS, DROPOUT_RATE, EPOCHS, BATCH_SIZE,
    LEARNING_RATE, SAVED_MODELS_DIR
)

class GRUModel:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_path = SAVED_MODELS_DIR / "gru_model.h5"
        self.scaler_path = SAVED_MODELS_DIR / "gru_scaler.pkl"

    def build(self):
        """Build GRU model architecture"""
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import GRU, Dense, Dropout
        from tensorflow.keras.optimizers import Adam

        model = Sequential([
            GRU(GRU_UNITS, return_sequences=True,
                input_shape=(SEQUENCE_LENGTH, NUM_FEATURES)),
            Dropout(DROPOUT_RATE),
            GRU(GRU_UNITS // 2, return_sequences=False),
            Dropout(DROPOUT_RATE),
            Dense(32, activation='relu'),
            Dense(1, activation='linear')
        ])

        model.compile(
            optimizer=Adam(learning_rate=LEARNING_RATE),
            loss='mse',
            metrics=['mae']
        )
        self.model = model
        print("GRU model built!")
        print(model.summary())
        return model

    def prepare_sequences(self, df: pd.DataFrame):
        """Convert dataframe into GRU sequences"""
        from sklearn.preprocessing import MinMaxScaler
        import pickle

        data = df[FEATURES].values
        target = df["vehicle_count"].values

        self.scaler = MinMaxScaler()
        data_scaled = self.scaler.fit_transform(data)

        with open(self.scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)

        X, y = [], []
        for i in range(SEQUENCE_LENGTH, len(data_scaled)):
            X.append(data_scaled[i-SEQUENCE_LENGTH:i])
            y.append(target[i])

        return np.array(X), np.array(y)

    def train(self, df: pd.DataFrame):
        """Train GRU on extracted features"""
        from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

        if self.model is None:
            self.build()

        X, y = self.prepare_sequences(df)

        split = int(len(X) * 0.8)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        print(f"Training samples: {len(X_train)}")
        print(f"Validation samples: {len(X_val)}")

        callbacks = [
            EarlyStopping(patience=10, restore_best_weights=True),
            ModelCheckpoint(str(self.model_path), save_best_only=True)
        ]

        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            callbacks=callbacks,
            verbose=1
        )
        print(f"Model saved: {self.model_path}")
        return history

    def predict(self, sequence: np.ndarray) -> float:
        """Predict green time for a sequence"""
        if self.model is None:
            self.load()
        seq_scaled = self.scaler.transform(sequence)
        seq_input = seq_scaled.reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)
        prediction = self.model.predict(seq_input, verbose=0)
        return float(prediction[0][0])

    def load(self):
        """Load saved model and scaler"""
        import pickle
        from tensorflow.keras.models import load_model
        self.model = load_model(str(self.model_path))
        with open(self.scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        print("GRU model loaded!")

    def evaluate(self, df: pd.DataFrame):
        """Evaluate model performance"""
        from sklearn.metrics import mean_absolute_error, mean_squared_error

        X, y = self.prepare_sequences(df)
        y_pred = self.model.predict(X, verbose=0).flatten()

        mae  = mean_absolute_error(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))

        print(f"MAE:  {mae:.4f}")
        print(f"RMSE: {rmse:.4f}")
        return {"mae": mae, "rmse": rmse}


if __name__ == "__main__":
    gru = GRUModel()
    gru.build()
    print("\nGRU Model ready!")
    print("Model path:", gru.model_path)