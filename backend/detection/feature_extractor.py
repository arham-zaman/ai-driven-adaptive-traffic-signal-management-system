import pandas as pd
import numpy as np
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import LANES, PROCESSED_DIR

class FeatureExtractor:
    def __init__(self, lane_area_pixels=50000):
        self.lane_area = lane_area_pixels
        self.prev_centers = {}  # track previous centers for speed

    def extract_features(self, frame_data: list, lane_name: str) -> pd.DataFrame:
        rows = []
        prev_count = 0
        prev_centers = []
        fps = 30  # assume 30fps

        for fd in frame_data:
            detections = fd["detections"]
            vehicle_count = len(detections)
            time_sec = fd["time_sec"]

            # ── Queue Length ──────────────────────────────────
            queue_length = self._estimate_queue(detections)

            # ── Density ───────────────────────────────────────
            total_vehicle_area = sum(
                d["width"] * d["height"] for d in detections
            )
            density = round(total_vehicle_area / self.lane_area, 4)

            # ── Real Speed Calculation ────────────────────────
            avg_speed = self._calculate_speed(
                detections, prev_centers, fps
            )

            # ── Count change ──────────────────────────────────
            count_change = abs(vehicle_count - prev_count)

            # ── Category ──────────────────────────────────────
            if vehicle_count <= 5:
                category = "LOW"
            elif vehicle_count <= 15:
                category = "MEDIUM"
            else:
                category = "HIGH"

            rows.append({
                "frame":         fd["frame"],
                "time_sec":      time_sec,
                "lane":          lane_name,
                "vehicle_count": vehicle_count,
                "queue_length":  queue_length,
                "density":       density,
                "avg_speed":     avg_speed,
                "count_change":  count_change,
                "category":      category,
            })

            prev_count   = vehicle_count
            prev_centers = [d["center"] for d in detections]

        df = pd.DataFrame(rows)
        return df

    def _calculate_speed(self, detections, prev_centers, fps):
        """Calculate average speed using optical flow approximation"""
        if not detections or not prev_centers:
            return 0.0

        curr_centers = [d["center"] for d in detections]
        speeds = []

        for curr in curr_centers:
            # Find closest previous center
            if prev_centers:
                distances = [
                    np.sqrt((curr[0]-p[0])**2 + (curr[1]-p[1])**2)
                    for p in prev_centers
                ]
                min_dist = min(distances)
                # pixels per frame → km/h approximation
                # assuming 1 pixel ≈ 0.05 meters, 5 frames skip
                speed_ms = (min_dist * 0.05 * fps) / 5
                speed_kmh = speed_ms * 3.6
                if speed_kmh < 120:  # filter unrealistic speeds
                    speeds.append(speed_kmh)

        return round(np.mean(speeds), 2) if speeds else 0.0

    def _estimate_queue(self, detections: list) -> int:
        if len(detections) < 2:
            return len(detections)
        centers = [d["center"] for d in detections]
        queued = 0
        for i, c1 in enumerate(centers):
            for j, c2 in enumerate(centers):
                if i != j:
                    dist = np.sqrt(
                        (c1[0]-c2[0])**2 + (c1[1]-c2[1])**2
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