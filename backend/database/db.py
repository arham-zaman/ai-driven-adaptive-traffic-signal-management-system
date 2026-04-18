from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import sys
sys.path.append('..')
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─── Tables ───────────────────────────────────────────────────
class TrafficLog(Base):
    __tablename__ = "traffic_logs"
    id          = Column(Integer, primary_key=True, index=True)
    timestamp   = Column(DateTime, default=datetime.utcnow)
    lane        = Column(String)
    vehicle_count = Column(Integer)
    queue_length  = Column(Float)
    avg_speed     = Column(Float)
    density       = Column(Float)

class SignalEvent(Base):
    __tablename__ = "signal_events"
    id          = Column(Integer, primary_key=True, index=True)
    timestamp   = Column(DateTime, default=datetime.utcnow)
    lane        = Column(String)
    signal_state = Column(String)   # green / yellow / red
    duration    = Column(Float)
    is_manual   = Column(Integer, default=0)

class Prediction(Base):
    __tablename__ = "predictions"
    id           = Column(Integer, primary_key=True, index=True)
    timestamp    = Column(DateTime, default=datetime.utcnow)
    lane         = Column(String)
    predicted_green_time = Column(Float)
    actual_green_time    = Column(Float, nullable=True)
    model_used   = Column(String)   # lstm / gru / xgboost

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database tables created!")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    init_db()