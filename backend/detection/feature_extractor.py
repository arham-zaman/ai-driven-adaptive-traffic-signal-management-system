import pandas as pd
import numpy as np
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import LANES, PROCESSED_DIR

class FeatureExtractor:
    def __init__(self, lane_area_pixels=50000):
        # lane_area_pixels = approximate pixel area of one lane zone
        self.lane_area = lane_area_pixels

    def extract_features(self, frame_data: list, lane_name: str) -> pd.DataFrame:
        """Convert raw frame detections into ML-ready features"""
        rows = []
        prev_count = 0

        for fd in frame_data:
            detections = fd["detections"]
            vehicle_count = len(detections)

            # ── Queue Length ──────────────────────────────────
            # vehicles that are close together = queued
            queue_length = self._estimate_queue(detections)

            # ── Density ───────────────────────────────────────
            total_vehicle_area = sum(
                d["width"] * d["height"] for d in detections
            )
            density = round(total_vehicle_area / self.lane_area, 4)

            # ── Avg Speed (estimated from count change) ───────
            count_change = abs(vehicle_count - prev_count)
            avg_speed = round(max(0, 30 - (queue_length * 5) - (density * 10)), 2)

            rows.append({
                "frame":         fd["frame"],
                "time_sec":      fd["time_sec"],
                "lane":          lane_name,
                "vehicle_count": vehicle_count,
                "queue_length":  queue_length,
                "density":       density,
                "avg_speed":     avg_speed,
                "count_change":  count_change,
            })
            prev_count = vehicle_count

        df = pd.DataFrame(rows)
        return df

    def _estimate_queue(self, detections: list) -> int:
        """Count vehicles that are closely packed — estimated queue"""
        if len(detections) < 2:
            return len(detections)

        centers = [d["center"] for d in detections]
        queued = 0
        for i, c1 in enumerate(centers):
            for j, c2 in enumerate(centers):
                if i != j:
                    dist = np.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2)
                    if dist < 80:   # pixels — vehicles close together
                        queued += 1
                        break
        return queued

    def save_features(self, df: pd.DataFrame, lane_name: str):
        """Save extracted features to CSV"""
        out_path = PROCESSED_DIR / f"{lane_name}_features.csv"
        if out_path.exists():
            existing = pd.read_csv(out_path)
            df = pd.concat([existing, df], ignore_index=True)
        df.to_csv(out_path, index=False)
        print(f"Saved: {out_path} — {len(df)} rows")
        return out_path

    def load_features(self, lane_name: str) -> pd.DataFrame:
        """Load saved features CSV"""
        path = PROCESSED_DIR / f"{lane_name}_features.csv"
        if not path.exists():
            raise FileNotFoundError(f"No features found for lane: {lane_name}")
        return pd.read_csv(path)

    def load_all_lanes(self) -> pd.DataFrame:
        """Load and combine features from all lanes"""
        dfs = []
        for lane in LANES:
            path = PROCESSED_DIR / f"{lane}_features.csv"
            if path.exists():
                dfs.append(pd.read_csv(path))
        if not dfs:
            raise FileNotFoundError("No feature CSVs found in processed/")
        return pd.concat(dfs, ignore_index=True)


if __name__ == "__main__":
    fe = FeatureExtractor()
    print("FeatureExtractor ready!")
    print("Output dir:", PROCESSED_DIR)