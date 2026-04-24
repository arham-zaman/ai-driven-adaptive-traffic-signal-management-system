import numpy as np
import pandas as pd
import pickle
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import SAVED_MODELS_DIR, DENSITY_CATEGORIES, GREEN_TIME_BY_CATEGORY

CLASSIFIER_FEATURES = ["queue_length", "avg_speed", "density", "count_change"]

class TrafficClassifier:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_path = SAVED_MODELS_DIR / "classifier.pkl"
        self.scaler_path = SAVED_MODELS_DIR / "classifier_scaler.pkl"
        self.classes = ["LOW", "MEDIUM", "HIGH"]
        self.classifier_features = CLASSIFIER_FEATURES

    def train(self, df: pd.DataFrame):
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import train_test_split, cross_val_score
        from sklearn.metrics import classification_report, accuracy_score
        from sklearn.utils.class_weight import compute_class_weight

        print("Training Random Forest Classifier...")

        if "category" not in df.columns:
            df["category"] = df["vehicle_count"].apply(
                lambda x: "LOW" if x <= 5
                else "MEDIUM" if x <= 15
                else "HIGH"
            )

        X = df[CLASSIFIER_FEATURES].values
        y = df["category"].values

        # ── Fix data imbalance ────────────────────────────────
        classes = np.unique(y)
        weights = compute_class_weight(
            class_weight='balanced',
            classes=classes,
            y=y
        )
        class_weight_dict = dict(zip(classes, weights))
        print(f"Class weights: {class_weight_dict}")

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2,
            random_state=42, stratify=y  # stratified split!
        )

        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight=class_weight_dict,  # balanced weights!
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)

        y_pred = self.model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)

        print(f"\nAccuracy: {acc*100:.2f}%")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))

        # ── Feature Importance ────────────────────────────────
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
            pickle.dump(self.scaler, f)
        print(f"\nRF Classifier saved: {self.model_path}")

        return {
            "accuracy": acc,
            "class_weights": class_weight_dict
        }

    def predict_category(self, features: np.ndarray) -> str:
        if self.model is None:
            self.load()
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        return self.model.predict(features_scaled)[0]

    def predict_proba(self, features: np.ndarray) -> dict:
        """Return probability for each class"""
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
            "category":    category,
            "green_time":  green_time,
            "confidence":  round(max(proba.values()) * 100, 2),
            "probabilities": proba,
            "model":       "random_forest",
            "reasoning":   f"Traffic is {category} → {green_time}s green time"
        }

    def load(self):
        with open(self.model_path, 'rb') as f:
            self.model = pickle.load(f)
        with open(self.scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        print("RF Classifier loaded!")

    def get_distribution(self, df: pd.DataFrame) -> dict:
        if "category" not in df.columns:
            df["category"] = df["vehicle_count"].apply(
                lambda x: "LOW" if x <= 5
                else "MEDIUM" if x <= 15
                else "HIGH"
            )
        dist = df["category"].value_counts().to_dict()
        total = len(df)
        print("\nTraffic Category Distribution:")
        for cat, count in dist.items():
            pct = (count/total)*100
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

    # Test
    test = np.array([4, 15.0, 2.5, 2])
    prediction = clf.predict_green_time(test)
    print(f"\nTest: {prediction}")