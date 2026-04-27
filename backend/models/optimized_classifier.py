import numpy as np
import pandas as pd
from pathlib import Path
import sys
import pickle
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import SAVED_MODELS_DIR


class OptimizedTrafficClassifier:
    """
    IMPROVEMENT #4: Both RF + XGBoost trained with SMOTE balancing
    Trains both, saves both, picks best automatically
    """

    def __init__(self):
        self.rf_model = None
        self.xgb_model = None
        self.best_model = None
        self.best_name = None
        self.scaler = None
        self.le = None

        self.rf_path   = SAVED_MODELS_DIR / "classifier_improved_rf.pkl"
        self.xgb_path  = SAVED_MODELS_DIR / "classifier_improved_xgb.pkl"
        self.scaler_path = SAVED_MODELS_DIR / "classifier_improved_scaler.pkl"
        self.le_path     = SAVED_MODELS_DIR / "classifier_improved_le.pkl"
        self.best_path   = SAVED_MODELS_DIR / "classifier_improved_best.pkl"

    def train(self, X_train, y_train, X_test, y_test):
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.ensemble import RandomForestClassifier
        from xgboost import XGBClassifier
        from imblearn.over_sampling import SMOTE
        from sklearn.metrics import accuracy_score

        print("\n" + "="*60)
        print("TRAINING IMPROVED CLASSIFIERS (RF + XGBoost)")
        print("="*60)

        # Scale + encode
        self.scaler = StandardScaler()
        X_train_s = self.scaler.fit_transform(X_train)
        X_test_s  = self.scaler.transform(X_test)

        self.le = LabelEncoder()
        y_train_enc = self.le.fit_transform(y_train)
        y_test_enc  = self.le.transform(y_test)

        # SMOTE balancing
        print("\nApplying SMOTE balancing...")
        sm = SMOTE(random_state=42)
        X_res, y_res = sm.fit_resample(X_train_s, y_train_enc)
        print(f"After SMOTE: {len(X_res)} samples")

        # ── Train Random Forest ────────────────────────────────
        print("\n[A] Training Random Forest...")
        self.rf_model = RandomForestClassifier(
            n_estimators=300,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            max_features='sqrt',
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        self.rf_model.fit(X_res, y_res)
        rf_pred = self.le.inverse_transform(self.rf_model.predict(X_test_s))
        rf_acc  = accuracy_score(y_test, rf_pred)
        print(f"Random Forest Accuracy: {rf_acc*100:.2f}%")

        # ── Train XGBoost ─────────────────────────────────────
        print("\n[B] Training XGBoost...")
        self.xgb_model = XGBClassifier(
            max_depth=7,
            learning_rate=0.05,
            n_estimators=300,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.5,
            reg_lambda=1.0,
            min_child_weight=3,
            gamma=0.5,
            eval_metric='mlogloss',
            random_state=42,
            n_jobs=-1,
            verbosity=0
        )
        self.xgb_model.fit(X_res, y_res)
        xgb_pred = self.le.inverse_transform(self.xgb_model.predict(X_test_s))
        xgb_acc  = accuracy_score(y_test, xgb_pred)
        print(f"XGBoost Accuracy:       {xgb_acc*100:.2f}%")

        # ── Pick best ─────────────────────────────────────────
        if rf_acc >= xgb_acc:
            self.best_model = self.rf_model
            self.best_name  = "Random Forest"
            best_acc = rf_acc
        else:
            self.best_model = self.xgb_model
            self.best_name  = "XGBoost"
            best_acc = xgb_acc

        print(f"\nBEST: {self.best_name} — {best_acc*100:.2f}%")

        # ── Save everything ───────────────────────────────────
        self._save_all()
        print("All classifiers saved!")

        return {"rf": rf_acc, "xgb": xgb_acc,
                "best": self.best_name, "best_acc": best_acc}

    def _save_all(self):
        with open(self.rf_path,     'wb') as f: pickle.dump(self.rf_model,   f)
        with open(self.xgb_path,    'wb') as f: pickle.dump(self.xgb_model,  f)
        with open(self.scaler_path, 'wb') as f: pickle.dump(self.scaler,      f)
        with open(self.le_path,     'wb') as f: pickle.dump(self.le,          f)
        best_bundle = {'model': self.best_model, 'name': self.best_name}
        with open(self.best_path,   'wb') as f: pickle.dump(best_bundle,      f)

    def load(self):
        with open(self.rf_path,     'rb') as f: self.rf_model  = pickle.load(f)
        with open(self.xgb_path,    'rb') as f: self.xgb_model = pickle.load(f)
        with open(self.scaler_path, 'rb') as f: self.scaler    = pickle.load(f)
        with open(self.le_path,     'rb') as f: self.le        = pickle.load(f)
        with open(self.best_path,   'rb') as f:
            bundle = pickle.load(f)
            self.best_model = bundle['model']
            self.best_name  = bundle['name']
        print(f"Classifiers loaded! Best: {self.best_name}")

    def evaluate(self, X_test, y_test):
        from sklearn.metrics import (accuracy_score, precision_score,
                                     recall_score, f1_score,
                                     classification_report)

        X_s = self.scaler.transform(X_test)

        print("\n" + "="*60)
        print("CLASSIFIER EVALUATION")
        print("="*60)

        results = {}
        for name, model in [("Random Forest", self.rf_model),
                             ("XGBoost",       self.xgb_model)]:
            y_pred = self.le.inverse_transform(model.predict(X_s))
            acc  = accuracy_score(y_test, y_pred)
            prec = precision_score(y_test, y_pred, average='weighted')
            rec  = recall_score(y_test, y_pred, average='weighted')
            f1   = f1_score(y_test, y_pred, average='weighted')

            print(f"\n{name}:")
            print(f"  Accuracy : {acc*100:.2f}%")
            print(f"  Precision: {prec*100:.2f}%")
            print(f"  Recall   : {rec*100:.2f}%")
            print(f"  F1-Score : {f1*100:.2f}%")
            print(classification_report(y_test, y_pred))

            results[name] = {'accuracy': acc, 'precision': prec,
                             'recall': rec, 'f1': f1}

        print(f"\nBEST MODEL: {self.best_name}")
        return results

    def predict(self, X):
        if self.best_model is None:
            self.load()
        X_s = self.scaler.transform(X)
        pred_enc  = self.best_model.predict(X_s)[0]
        pred_prob = self.best_model.predict_proba(X_s)[0]
        label = self.le.inverse_transform([pred_enc])[0]
        conf  = pred_prob.max() * 100
        return {"category": label, "confidence": round(conf, 2),
                "model_used": self.best_name}