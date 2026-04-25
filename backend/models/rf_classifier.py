import numpy as np
import pandas as pd
import pickle
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import SAVED_MODELS_DIR, DENSITY_CATEGORIES, GREEN_TIME_BY_CATEGORY

CLASSIFIER_FEATURES = ["queue_length", "density", "congestion_ratio", "count_change"]

class TrafficClassifier:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_path = SAVED_MODELS_DIR / "classifier.pkl"
        self.scaler_path = SAVED_MODELS_DIR / "classifier_scaler.pkl"
        self.classes = ["LOW", "MEDIUM", "HIGH"]
        self.classifier_features = CLASSIFIER_FEATURES

    def _add_category(self, df: pd.DataFrame) -> pd.DataFrame:
        if "category" not in df.columns:
            df = df.copy()
            df["category"] = df["vehicle_count"].apply(
                lambda x: "LOW" if x <= 5
                else "MEDIUM" if x <= 15
                else "HIGH"
            )
        return df

    def train(self, df: pd.DataFrame):
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report, accuracy_score
        from imblearn.over_sampling import SMOTE  # pip install imbalanced-learn

        print("Training Random Forest Classifier...")
        df = self._add_category(df)

        X = df[CLASSIFIER_FEATURES].values
        y = df["category"].values

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # ── Show distribution BEFORE SMOTE ────────────────────
        print("\nClass distribution BEFORE SMOTE:")
        unique, counts = np.unique(y, return_counts=True)
        for u, c in zip(unique, counts):
            print(f"  {u}: {c} samples")

        # ── Apply SMOTE ────────────────────────────────────────
        smote = SMOTE(random_state=42)
        X_resampled, y_resampled = smote.fit_resample(X_scaled, y)

        print("\nClass distribution AFTER SMOTE:")
        unique, counts = np.unique(y_resampled, return_counts=True)
        for u, c in zip(unique, counts):
            print(f"  {u}: {c} samples")

        X_train, X_test, y_train, y_test = train_test_split(
            X_resampled, y_resampled,
            test_size=0.2, random_state=42, stratify=y_resampled
        )

        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)

        y_pred = self.model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)

        print(f"\nAccuracy: {acc*100:.2f}%")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))

        # Feature Importance
        importance = dict(zip(
            CLASSIFIER_FEATURES, self.model.feature_importances_
        ))
        print("Feature Importance:")
        for feat, imp in sorted(
            importance.items(), key=lambda x: x[1], reverse=True
        ):
            print(f"  {feat}: {imp:.4f}")

        with open(self.model_path, 'wb') as f:
            pickle.dump(self.model, f)
        with open(self.scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        print(f"\nRF Classifier saved: {self.model_path}")

        return {"accuracy": acc}

    def predict_category(self, features: np.ndarray) -> str:
        if self.model is None:
            self.load()
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        return self.model.predict(features_scaled)[0]

    def predict_proba(self, features: np.ndarray) -> dict:
        if self.model is None:
            self.load()
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        proba = self.model.predict_proba(features_scaled)[0]
        return dict(zip(self.model.classes_, proba.tolist()))

    def predict_green_time(self, features: np.ndarray) -> dict:
        category = self.predict_category(features)
        green_time = GREEN_TIME_BY_CATEGORY[category]
        proba = self.predict_proba(features)
        return {
            "category":      category,
            "green_time":    green_time,
            "confidence":    round(max(proba.values()) * 100, 2),
            "probabilities": proba,
            "model":         "random_forest",
            "reasoning":     f"Traffic is {category} → {green_time}s green time"
        }

    def load(self):
        with open(self.model_path, 'rb') as f:
            self.model = pickle.load(f)
        with open(self.scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        print("RF Classifier loaded!")

    def get_distribution(self, df: pd.DataFrame) -> dict:
        df = self._add_category(df)
        dist = df["category"].value_counts().to_dict()
        total = len(df)
        print("\nTraffic Category Distribution:")
        for cat, count in dist.items():
            pct = (count / total) * 100
            print(f"  {cat}: {count} samples ({pct:.1f}%)")
        return dist


if __name__ == "__main__":
    from backend.config import PROCESSED_DIR
    dfs = []
    for csv_file in PROCESSED_DIR.glob("*.csv"):
        dfs.append(pd.read_csv(csv_file))
    df = pd.concat(dfs, ignore_index=True)

    clf = TrafficClassifier()
    clf.get_distribution(df)
    result = clf.train(df)
    print(f"\nFinal Accuracy: {result['accuracy']*100:.2f}%")

    test = np.array([4, 15.0, 2.5, 2])
    prediction = clf.predict_green_time(test)
    print(f"\nTest: {prediction}")