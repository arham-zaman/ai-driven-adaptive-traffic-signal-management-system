import pandas as pd
import numpy as np
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import LANES, PROCESSED_DIR

class FeatureExtractor:
    def __init__(self, lane_area_pixels=50000):
        self.lane_area = lane_area_pixels

    def extract_features(self, frame_data: list, lane_name: str) -> pd.DataFrame:
        rows = []
        prev_count = 0

        for fd in frame_data:
            detections    = fd["detections"]
            vehicle_count = len(detections)
            time_sec      = fd["time_sec"]

            # ── Queue Length ──────────────────────────────────
            queue_length = self._estimate_queue(detections)

            # ── Density ───────────────────────────────────────
            total_vehicle_area = sum(
                d["width"] * d["height"] for d in detections
            )
            density = round(total_vehicle_area / self.lane_area, 4)

            # ── Congestion Ratio ──────────────────────────────
            # ✅ FIXED FORMULA: min(1.0, queued / total)
            # 0.0 = no congestion (vehicles flowing)
            # 1.0 = full congestion (all vehicles queued)
            congestion_ratio = round(
                min(1.0, queue_length / max(vehicle_count, 1)), 4
            )

            # ── Count Change ──────────────────────────────────
            count_change = abs(vehicle_count - prev_count)

            # ── Category ──────────────────────────────────────
            if vehicle_count <= 5:
                category = "LOW"
            elif vehicle_count <= 15:
                category = "MEDIUM"
            else:
                category = "HIGH"

            rows.append({
                "frame":            fd["frame"],
                "time_sec":         time_sec,
                "lane":             lane_name,
                "vehicle_count":    vehicle_count,
                "queue_length":     queue_length,
                "density":          density,
                "congestion_ratio": congestion_ratio,  # ✅ CORRECT
                "count_change":     count_change,
                "category":         category,
            })

            prev_count = vehicle_count

        df = pd.DataFrame(rows)
        return df

    def _estimate_queue(self, detections: list) -> int:
        """Count vehicles that are close together (queued)"""
        if len(detections) < 2:
            return len(detections)
        centers = [d["center"] for d in detections]
        queued  = 0
        for i, c1 in enumerate(centers):
            for j, c2 in enumerate(centers):
                if i != j:
                    dist = np.sqrt(
                        (c1[0] - c2[0])**2 + (c1[1] - c2[1])**2
                    )
                    if dist < 80:
                        queued += 1
                        break
        return queued

    def save_features(self, df: pd.DataFrame, lane_name: str):
        out_path = PROCESSED_DIR / f"{lane_name}_features.csv"
        df.to_csv(out_path, index=False)
        print(f"Saved: {out_path} — {len(df)} rows")
        return out_path

    def load_features(self, lane_name: str) -> pd.DataFrame:
        path = PROCESSED_DIR / f"{lane_name}_features.csv"
        if not path.exists():
            raise FileNotFoundError(f"No features for lane: {lane_name}")
        return pd.read_csv(path)

    def load_all_lanes(self) -> pd.DataFrame:
        dfs = []
        for lane in LANES:
            path = PROCESSED_DIR / f"{lane}_features.csv"
            if path.exists():
                dfs.append(pd.read_csv(path))
        if not dfs:
            raise FileNotFoundError("No CSVs found!")
        return pd.concat(dfs, ignore_index=True)


if __name__ == "__main__":
    fe = FeatureExtractor()
    print("FeatureExtractor ready!")
    print("Output dir:", PROCESSED_DIR)