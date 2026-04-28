# 🚦 AI-Driven Adaptive Traffic Signal Management System

> **BS Final Year Project** — AI-powered traffic signal system that predicts optimal green light timing using deep learning and computer vision.

---

## 📊 Model Performance

| Model | Task | Result |
|-------|------|--------|
| **GRU Improved** | Green Time Prediction | **MAE: 2.89s** (+74% vs baseline) |
| **Random Forest** | Traffic Classification | **91.16% accuracy** |
| **XGBoost (Tuned)** | Traffic Classification | **88.85% accuracy** |

### GRU Breakdown by Traffic Level
| Traffic Level | MAE |
|--------------|-----|
| Light (10–20s) | 2.22s |
| **Normal (20–40s)** | **2.78s** ⭐ |
| Heavy (40–60s) | 3.46s |

---

## 🧠 Improvements Applied

| # | Improvement | Impact |
|---|------------|--------|
| 1 | Custom Huber Weighted Loss | Critical range (20-40s) accuracy ↑ |
| 2 | SMOTE Data Balancing | Class imbalance fixed |
| 3 | LightGBM + Optuna Tuning | 3 classifiers auto-tuned |
| 4 | Ensemble Evaluation | Best model auto-selected |

---

## 🏗️ Project Structure

```
traffic-signal-ai/
│
├── backend/
│   ├── config.py                    # Configuration
│   ├── detection/
│   │   ├── detector.py              # YOLOv8 vehicle detection
│   │   ├── feature_extractor.py     # Basic features
│   │   └── feature_extractor_advanced.py  # Advanced features
│   │
│   ├── models/
│   │   ├── lstm_model.py            # LSTM (baseline)
│   │   ├── gru_model.py             # GRU (baseline)
│   │   ├── gru_model_improved.py    # GRU + Custom Loss ⭐
│   │   ├── rf_classifier.py         # Random Forest
│   │   ├── xgboost_classifier.py    # XGBoost
│   │   ├── optimized_classifier.py  # LightGBM + Tuned RF/XGB
│   │   ├── train.py                 # Basic training
│   │   ├── train_improved.py        # Improved training ⭐
│   │   ├── evaluate.py              # Basic evaluation
│   │   └── evaluate_improved.py     # Improved evaluation ⭐
│   │
│   ├── signal_controller/
│   │   ├── phase_manager.py         # Signal phase management
│   │   ├── timer.py                 # Green time timer
│   │   └── emergency_override.py    # Emergency vehicle priority
│   │
│   ├── api/
│   │   ├── main.py                  # FastAPI app
│   │   ├── websocket.py             # Real-time updates
│   │   └── routes/
│   │       ├── predictions.py       # Prediction endpoints
│   │       ├── signals.py           # Signal control
│   │       ├── logs.py              # Traffic logs
│   │       └── manual_control.py    # Manual override
│   │
│   └── database/
│       ├── db.py                    # Database connection
│       └── models.py                # DB models
│
├── frontend/                        # React + TypeScript UI
├── notebooks/                       # Analysis notebooks
├── requirements.txt
└── README.md
```

---

## ⚙️ Setup & Installation

### 1. Clone Repository
```bash
git clone https://github.com/arham-zaman/ai-driven-adaptive-traffic-signal-management-system
cd ai-driven-adaptive-traffic-signal-management-system
```

### 2. Create Virtual Environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Train Models
```bash
# Train all models (basic + improved)
python -m backend.models.train
python -m backend.models.train_improved
```

### 5. Evaluate Models
```bash
python -m backend.models.evaluate
python -m backend.models.evaluate_improved
```

### 6. Start Backend API
```bash
uvicorn backend.api.main:app --reload --port 8000
```

### 7. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/predictions/predict` | Predict green time |
| GET | `/signals/status` | Current signal status |
| POST | `/signals/manual` | Manual override |
| POST | `/signals/emergency` | Emergency override |
| GET | `/logs/history` | Traffic history |
| WS | `/ws` | Real-time WebSocket |

### Example Prediction Request
```bash
POST http://localhost:8000/predictions/predict?lane=north&vehicle_count=8&queue_length=3&density=2.5&congestion_ratio=0.375&count_change=1
```

### Example Response
```json
{
  "lane": "north",
  "predicted_green_time": 28,
  "traffic_category": "MEDIUM",
  "classifier_green": 30,
  "gru_green": 26,
  "classifier_confidence": 89.5,
  "model_used": "pipeline(gru_improved+xgboost)"
}
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Detection** | YOLOv8 + OpenCV |
| **Deep Learning** | TensorFlow + Keras (GRU, LSTM) |
| **ML Models** | XGBoost, LightGBM, Random Forest |
| **Optimization** | Optuna (Bayesian Tuning) |
| **Backend API** | FastAPI + WebSocket |
| **Database** | SQLite + SQLAlchemy |
| **Frontend** | React + TypeScript + Tailwind + Recharts |

---

## 👥 Team

- **Arham Zaman** — AI/ML Models, Backend API
- **Arham Zaman** — Frontend, Integration

---

## 📄 License

This project is for academic purposes — BS Final Year Project.