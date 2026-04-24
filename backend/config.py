import os
print(os.getcwd())  # current directory
from pathlib import Path

# ─── Base Paths ───────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RAW_VIDEOS_DIR = DATA_DIR / "raw_videos"
EXTRACTED_FRAMES_DIR = DATA_DIR / "extracted_frames"
PROCESSED_DIR = DATA_DIR / "processed"
SAVED_MODELS_DIR = BASE_DIR / "models" / "saved_models"

# ─── Create dirs if not exist ─────────────────────────────────
for d in [RAW_VIDEOS_DIR, EXTRACTED_FRAMES_DIR, PROCESSED_DIR, SAVED_MODELS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Video / Detection Settings ───────────────────────────────
YOLO_MODEL = "yolov8n.pt"          # nano model — fast on CPU
FRAME_SKIP = 5                      # process every 5th frame
CONFIDENCE_THRESHOLD = 0.4          # min detection confidence
VEHICLE_CLASSES = [2, 3, 5, 7]     # car, motorcycle, bus, truck

# ─── 4-Way Intersection Lane Config ───────────────────────────
LANES = ["north", "south", "east", "west"]
NUM_LANES = len(LANES)

# ─── Signal Timing Settings ───────────────────────────────────
MIN_GREEN_TIME = 10     # seconds
MAX_GREEN_TIME = 60     # seconds
YELLOW_TIME = 3         # seconds
DEFAULT_CYCLE = 30      # seconds

# ─── LSTM / GRU Model Settings ────────────────────────────────
SEQUENCE_LENGTH = 10    # last 10 time steps as input
FEATURES = [
    "vehicle_count",
    "queue_length",
    "avg_speed",
    "density"
]
NUM_FEATURES = len(FEATURES)
LSTM_UNITS = 64
GRU_UNITS = 64
DROPOUT_RATE = 0.2
EPOCHS = 50
BATCH_SIZE = 32
LEARNING_RATE = 0.001

# ─── API Settings ─────────────────────────────────────────────
API_HOST = "0.0.0.0"
API_PORT = 8000
CORS_ORIGINS = ["http://localhost:3000"]   # React frontend

# ─── Database ─────────────────────────────────────────────────
DATABASE_URL = f"sqlite:///{BASE_DIR}/database/traffic.db"
# ─── Traffic Density Categories ───────────────────────────────
DENSITY_CATEGORIES = {
    "LOW":    (0, 5),
    "MEDIUM": (6, 15),
    "HIGH":   (16, 9999)
}

GREEN_TIME_BY_CATEGORY = {
    "LOW":    15,
    "MEDIUM": 30,
    "HIGH":   50
}

# ─── Updated Model Settings ───────────────────────────────────
EPOCHS = 100  # pehle 50 tha