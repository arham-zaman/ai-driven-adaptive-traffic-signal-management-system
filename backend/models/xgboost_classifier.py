import numpy as np
import pandas as pd
import pickle
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import SAVED_MODELS_DIR, DENSITY_CATEGORIES, GREEN_TIME_BY_CATEGORY

CLASSIFIER_FEATURES = ["queue_length", "avg_speed", "density", "count_change"]

class XGBoostClassifier:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.le = None
        self.model_path = SAVED_MODELS_DIR / "xgboost_classifier.pkl"
        self.scaler_path = SAVED_MODELS_DIR / "xgboost_scaler.pkl"
        self.classes = ["LOW", "MEDIUM", "HIGH"]

    def train(self, df: pd.DataFrame):
        from xgboost import XGBClassifier
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report, accuracy_score
        from sklearn.utils.class_weight import compute_sample_weight

        print("Training XGBoost Classifier...")

        if "category" not in df.columns:
            df["category"] = df["vehicle_count"].apply(
                lambda x: "LOW" if x <= 5
                else "MEDIUM" if x <= 15
                else "HIGH"
            )

        X = df[CLASSIFIER_FEATURES].values
        y = df["category"].values

        self.le = LabelEncoder()
        y_encoded = self.le.fit_transform(y)

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, test_size=0.2,
            random_state=42, stratify=y_encoded
        )

        # Fix imbalance with sample weights
        sample_weights = compute_sample_weight(
            class_weight='balanced',
            y=y_train
        )

        self.model = XGBClassifier(
            n_estimators=300,
            max_depth=8,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric='mlogloss',
            random_state=42
        )
        self.model.fit(
            X_train, y_train,
            sample_weight=sample_weights,
            eval_set=[(X_test, y_test)],
            verbose=False
        )

        y_pred = self.model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)

        print(f"\nAccuracy: {acc*100:.2f}%")
        print("\nClassification Report:")
        print(classification_report(
            y_test, y_pred,
            target_names=self.le.classes_
        ))

        # Feature importance
        importance = dict(zip(
            CLASSIFIER_FEATURES,
            self.model.feature_importances_
        ))
        print("Feature Importance:")
        for feat, imp in sorted(
            importance.items(), key=lambda x: x[1], reverse=True
        ):
            print(f"  {feat}: {imp:.4f}")

        with open(self.model_path, 'wb') as f:
            pickle.dump(self.model, f)
        with open(self.scaler_path, 'wb') as f:
            pickle.dump((self.scaler, self.le), f)
        print(f"\nXGBoost Classifier saved: {self.model_path}")

        return {"accuracy": acc}

    def predict_category(self, features: np.ndarray) -> str:
        if self.model is None:
            self.load()
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        pred = self.model.predict(features_scaled)[0]
        return self.le.inverse_transform([pred])[0]

    def predict_proba(self, features: np.ndarray) -> dict:
        if self.model is None:
            self.load()
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        proba = self.model.predict_proba(features_scaled)[0]
        return dict(zip(self.le.classes_, proba.tolist()))

    def predict_green_time(self, features: np.ndarray) -> dict:
        category = self.predict_category(features)
        green_time = GREEN_TIME_BY_CATEGORY[category]
        proba = self.predict_proba(features)
        return {
            "category":      category,
            "green_time":    green_time,
            "confidence":    round(max(proba.values()) * 100, 2),
            "probabilities": proba,
            "model":         "xgboost",
            "reasoning":     f"Traffic is {category} → {green_time}s green time"
        }

    def load(self):
        with open(self.model_path, 'rb') as f:
            self.model = pickle.load(f)
        with open(self.scaler_path, 'rb') as f:
            self.scaler, self.le = pickle.load(f)
        print("XGBoost Classifier loaded!")

    def feature_importance(self):
        if self.model is None:
            self.load()
        importance = dict(zip(
            CLASSIFIER_FEATURES,
            self.model.feature_importances_
        ))
        return dict(sorted(
            importance.items(),
            key=lambda x: x[1], reverse=True
        ))


if __name__ == "__main__":
    from backend.config import PROCESSED_DIR

    dfs = []
    for csv_file in PROCESSED_DIR.glob("*.csv"):
        dfs.append(pd.read_csv(csv_file))
    df = pd.concat(dfs, ignore_index=True)

    xgb = XGBoostClassifier()
    result = xgb.train(df)
    print(f"\nFinal Accuracy: {result['accuracy']*100:.2f}%")

    test = np.array([4, 15.0, 2.5, 2])
    prediction = xgb.predict_green_time(test)
    print(f"\nTest: {prediction}")