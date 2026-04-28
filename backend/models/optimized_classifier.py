import numpy as np
import pandas as pd
from pathlib import Path
import sys
import pickle
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import SAVED_MODELS_DIR


class OptimizedTrafficClassifier:
    """
    IMPROVEMENT #4: LightGBM + Tuned XGBoost + Tuned RF
    Best model auto-selected
    """

    def __init__(self):
        self.lgbm_model  = None
        self.xgb_model   = None
        self.rf_model    = None
        self.best_model  = None
        self.best_name   = None
        self.scaler      = None
        self.le          = None

        self.lgbm_path   = SAVED_MODELS_DIR / "classifier_lgbm.pkl"
        self.xgb_path    = SAVED_MODELS_DIR / "classifier_improved_xgb.pkl"
        self.rf_path     = SAVED_MODELS_DIR / "classifier_improved_rf.pkl"
        self.scaler_path = SAVED_MODELS_DIR / "classifier_improved_scaler.pkl"
        self.le_path     = SAVED_MODELS_DIR / "classifier_improved_le.pkl"
        self.best_path   = SAVED_MODELS_DIR / "classifier_improved_best.pkl"

    def train(self, X_train, y_train, X_test, y_test):
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.ensemble import RandomForestClassifier
        from xgboost import XGBClassifier
        from imblearn.over_sampling import SMOTE
        from sklearn.metrics import accuracy_score, classification_report
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)

        # Install lightgbm if needed
        try:
            import lightgbm as lgb
        except ImportError:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip",
                                   "install", "lightgbm", "-q"])
            import lightgbm as lgb

        print("\n" + "="*60)
        print("TRAINING: LightGBM + XGBoost + RF (with Optuna tuning)")
        print("="*60)

        # Scale + Encode
        self.scaler = StandardScaler()
        X_tr = self.scaler.fit_transform(X_train)
        X_te = self.scaler.transform(X_test)

        self.le = LabelEncoder()
        y_tr = self.le.fit_transform(y_train)
        y_te = self.le.transform(y_test)

        # SMOTE
        print("\nApplying SMOTE balancing...")
        sm = SMOTE(random_state=42)
        X_res, y_res = sm.fit_resample(X_tr, y_tr)
        print(f"After SMOTE: {len(X_res)} samples")

        scores = {}

        # ── LightGBM (Optuna tuned) ────────────────────────────
        print("\n[A] Tuning LightGBM with Optuna (30 trials)...")

        def lgbm_objective(trial):
            params = {
                'num_leaves':        trial.suggest_int('num_leaves', 20, 150),
                'max_depth':         trial.suggest_int('max_depth', 3, 15),
                'learning_rate':     trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
                'n_estimators':      trial.suggest_int('n_estimators', 100, 600),
                'subsample':         trial.suggest_float('subsample', 0.6, 1.0),
                'colsample_bytree':  trial.suggest_float('colsample_bytree', 0.6, 1.0),
                'reg_alpha':         trial.suggest_float('reg_alpha', 0.0, 2.0),
                'reg_lambda':        trial.suggest_float('reg_lambda', 0.0, 2.0),
                'min_child_samples': trial.suggest_int('min_child_samples', 5, 50),
            }
            from sklearn.model_selection import cross_val_score
            clf = lgb.LGBMClassifier(**params, random_state=42,
                                     n_jobs=-1, verbose=-1)
            scores = cross_val_score(clf, X_res, y_res,
                                     cv=3, scoring='accuracy', n_jobs=-1)
            return scores.mean()

        lgbm_study = optuna.create_study(direction='maximize')
        lgbm_study.optimize(lgbm_objective, n_trials=30)
        best_lgbm_params = lgbm_study.best_params

        self.lgbm_model = lgb.LGBMClassifier(
            **best_lgbm_params, random_state=42, n_jobs=-1, verbose=-1
        )
        self.lgbm_model.fit(X_res, y_res)
        lgbm_pred = self.le.inverse_transform(self.lgbm_model.predict(X_te))
        lgbm_acc  = accuracy_score(y_test, lgbm_pred)
        scores['LightGBM'] = lgbm_acc
        print(f"  LightGBM:     {lgbm_acc*100:.2f}%")

        # ── XGBoost (Optuna tuned) ─────────────────────────────
        print("\n[B] Tuning XGBoost with Optuna (30 trials)...")

        def xgb_objective(trial):
            params = {
                'max_depth':        trial.suggest_int('max_depth', 3, 12),
                'learning_rate':    trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
                'n_estimators':     trial.suggest_int('n_estimators', 100, 600),
                'subsample':        trial.suggest_float('subsample', 0.6, 1.0),
                'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                'reg_alpha':        trial.suggest_float('reg_alpha', 0.0, 2.0),
                'reg_lambda':       trial.suggest_float('reg_lambda', 0.0, 2.0),
                'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
                'gamma':            trial.suggest_float('gamma', 0.0, 3.0),
            }
            from sklearn.model_selection import cross_val_score
            clf = XGBClassifier(**params, eval_metric='mlogloss',
                                random_state=42, n_jobs=-1, verbosity=0)
            scores = cross_val_score(clf, X_res, y_res,
                                     cv=3, scoring='accuracy', n_jobs=-1)
            return scores.mean()

        xgb_study = optuna.create_study(direction='maximize')
        xgb_study.optimize(xgb_objective, n_trials=30)
        best_xgb_params = xgb_study.best_params

        self.xgb_model = XGBClassifier(
            **best_xgb_params, eval_metric='mlogloss',
            random_state=42, n_jobs=-1, verbosity=0
        )
        self.xgb_model.fit(X_res, y_res)
        xgb_pred = self.le.inverse_transform(self.xgb_model.predict(X_te))
        xgb_acc  = accuracy_score(y_test, xgb_pred)
        scores['XGBoost'] = xgb_acc
        print(f"  XGBoost:      {xgb_acc*100:.2f}%")

        # ── Random Forest (Optuna tuned) ───────────────────────
        print("\n[C] Tuning Random Forest with Optuna (20 trials)...")

        def rf_objective(trial):
            params = {
                'n_estimators':     trial.suggest_int('n_estimators', 100, 600),
                'max_depth':        trial.suggest_int('max_depth', 5, 30),
                'min_samples_split':trial.suggest_int('min_samples_split', 2, 10),
                'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 5),
                'max_features':     trial.suggest_categorical('max_features',
                                                              ['sqrt', 'log2']),
            }
            from sklearn.model_selection import cross_val_score
            clf = RandomForestClassifier(**params, random_state=42, n_jobs=-1)
            scores = cross_val_score(clf, X_res, y_res,
                                     cv=3, scoring='accuracy', n_jobs=-1)
            return scores.mean()

        rf_study = optuna.create_study(direction='maximize')
        rf_study.optimize(rf_objective, n_trials=20)
        best_rf_params = rf_study.best_params

        self.rf_model = RandomForestClassifier(
            **best_rf_params, random_state=42, n_jobs=-1
        )
        self.rf_model.fit(X_res, y_res)
        rf_pred = self.le.inverse_transform(self.rf_model.predict(X_te))
        rf_acc  = accuracy_score(y_test, rf_pred)
        scores['Random Forest'] = rf_acc
        print(f"  Random Forest: {rf_acc*100:.2f}%")

        # ── Pick Best ──────────────────────────────────────────
        best_name = max(scores, key=scores.get)
        best_acc  = scores[best_name]

        model_map = {
            'LightGBM':     self.lgbm_model,
            'XGBoost':      self.xgb_model,
            'Random Forest': self.rf_model
        }
        self.best_model = model_map[best_name]
        self.best_name  = best_name

        print("\n" + "="*60)
        print("RESULTS SUMMARY:")
        for name, acc in sorted(scores.items(),
                                key=lambda x: x[1], reverse=True):
            marker = " ← BEST" if name == best_name else ""
            print(f"  {name:<16}: {acc*100:.2f}%{marker}")

        print("\nClassification Report (Best Model):")
        best_pred = (lgbm_pred if best_name == 'LightGBM'
                     else xgb_pred if best_name == 'XGBoost'
                     else rf_pred)
        print(classification_report(y_test, best_pred))

        self._save_all()
        print(f"BEST: {best_name} — {best_acc*100:.2f}%")
        print("All classifiers saved!")
        print("="*60)

        return scores

    def _save_all(self):
        with open(self.lgbm_path,   'wb') as f: pickle.dump(self.lgbm_model,  f)
        with open(self.xgb_path,    'wb') as f: pickle.dump(self.xgb_model,   f)
        with open(self.rf_path,     'wb') as f: pickle.dump(self.rf_model,    f)
        with open(self.scaler_path, 'wb') as f: pickle.dump(self.scaler,      f)
        with open(self.le_path,     'wb') as f: pickle.dump(self.le,          f)
        best_bundle = {'model': self.best_model, 'name': self.best_name}
        with open(self.best_path,   'wb') as f: pickle.dump(best_bundle,      f)

    def load(self):
        with open(self.lgbm_path,   'rb') as f: self.lgbm_model  = pickle.load(f)
        with open(self.xgb_path,    'rb') as f: self.xgb_model   = pickle.load(f)
        with open(self.rf_path,     'rb') as f: self.rf_model    = pickle.load(f)
        with open(self.scaler_path, 'rb') as f: self.scaler      = pickle.load(f)
        with open(self.le_path,     'rb') as f: self.le          = pickle.load(f)
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
        models = {
            "LightGBM":     self.lgbm_model,
            "XGBoost":      self.xgb_model,
            "Random Forest": self.rf_model
        }

        for name, model in models.items():
            y_pred = self.le.inverse_transform(model.predict(X_s))
            acc  = accuracy_score(y_test, y_pred)
            prec = precision_score(y_test, y_pred, average='weighted')
            rec  = recall_score(y_test, y_pred, average='weighted')
            f1   = f1_score(y_test, y_pred, average='weighted')

            marker = " ← BEST" if name == self.best_name else ""
            print(f"\n{name}{marker}:")
            print(f"  Accuracy : {acc*100:.2f}%")
            print(f"  Precision: {prec*100:.2f}%")
            print(f"  Recall   : {rec*100:.2f}%")
            print(f"  F1-Score : {f1*100:.2f}%")
            if name == self.best_name:
                print(classification_report(y_test, y_pred))

            results[name] = {'accuracy': acc, 'precision': prec,
                             'recall': rec,   'f1': f1}

        return results

    def predict(self, X):
        if self.best_model is None:
            self.load()
        X_s   = self.scaler.transform(np.array(X).reshape(1, -1))
        pred  = self.best_model.predict(X_s)[0]
        prob  = self.best_model.predict_proba(X_s)[0]
        label = self.le.inverse_transform([pred])[0]
        return {
            "category":   label,
            "confidence": round(prob.max() * 100, 2),
            "model_used": self.best_name
        }