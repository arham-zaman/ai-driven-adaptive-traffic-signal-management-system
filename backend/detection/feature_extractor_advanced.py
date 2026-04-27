import pandas as pd
import numpy as np
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import LANES, PROCESSED_DIR

class AdvancedFeatureExtractor:
    """
    ✅ IMPROVEMENT #1: Advanced Features
    - Temporal trends (3, 5 frame windows)
    - Acceleration/deceleration
    - Normalized congestion (0-1)
    - Occupancy ratio
    - Data augmentation
    """
    
    def __init__(self, lane_area_pixels=50000):
        self.lane_area = lane_area_pixels

    def extract_features(self, frame_data: list, lane_name: str) -> pd.DataFrame:
        """Extract basic + advanced features"""
        rows = []
        
        # Precompute vehicle counts for trends
        vehicle_counts = [len(fd["detections"]) for fd in frame_data]
        queue_lengths = []
        densities = []
        
        # First pass: compute basic metrics
        for fd in frame_data:
            detections = fd["detections"]
            queue_length = self._estimate_queue(detections)
            queue_lengths.append(queue_length)
            
            total_vehicle_area = sum(
                d["width"] * d["height"] for d in detections
            )
            density = round(total_vehicle_area / self.lane_area, 4)
            densities.append(density)
        
        # Second pass: compute features with trends
        for i, fd in enumerate(frame_data):
            detections = fd["detections"]
            vehicle_count = vehicle_counts[i]
            queue_length = queue_lengths[i]
            density = densities[i]
            time_sec = fd["time_sec"]
            
            # ── Basic Features ────────────────────────────────────
            congestion_ratio = round(
                min(1.0, queue_length / max(vehicle_count, 1)), 4
            )
            
            count_change = (
                abs(vehicle_count - vehicle_counts[i-1]) if i > 0 else 0
            )
            
            # ── Temporal Trends (3 frames back) ───────────────────
            if i >= 3:
                vehicle_trend_3 = vehicle_count - vehicle_counts[i-3]
                queue_trend_3 = queue_length - queue_lengths[i-3]
            else:
                vehicle_trend_3 = 0
                queue_trend_3 = 0
            
            # ── Temporal Acceleration (5 frames) ──────────────────
            if i >= 5:
                # Second derivative: change in change
                vehicle_acceleration = (
                    vehicle_counts[i] - 2*vehicle_counts[i-3] + vehicle_counts[i-5]
                )
            else:
                vehicle_acceleration = 0
            
            # ── Normalized Congestion (0-1 scale) ─────────────────
            # Better than simple ratio — accounts for both queue and count
            normalized_congestion = round(
                min(1.0, (queue_length + vehicle_count/10) / 10), 4
            )
            
            # ── Occupancy Ratio (relative to recent max) ──────────
            if i > 0:
                recent_max = max(vehicle_counts[max(0, i-10):i+1])
            else:
                recent_max = vehicle_count
            occupancy_ratio = round(
                vehicle_count / max(recent_max, 1), 4
            )
            
            # ── Moving Average (smoothing) ────────────────────────
            if i >= 2:
                vehicle_ma_3 = round(
                    sum(vehicle_counts[max(0, i-2):i+1]) / 3, 2
                )
            else:
                vehicle_ma_3 = float(vehicle_count)
            
            # ── Density trend ────────────────────────────────────
            if i >= 3:
                density_trend = round(density - densities[i-3], 4)
            else:
                density_trend = 0.0
            
            # ── Category ──────────────────────────────────────────
            category = self._get_category(vehicle_count)
            
            rows.append({
                # Original features (9)
                "frame":                 fd["frame"],
                "time_sec":              time_sec,
                "lane":                  lane_name,
                "vehicle_count":         vehicle_count,
                "queue_length":          queue_length,
                "density":               density,
                "congestion_ratio":      congestion_ratio,
                "count_change":          count_change,
                "category":              category,
                # ✅ NEW: Advanced features (9)
                "vehicle_trend_3":       vehicle_trend_3,
                "queue_trend_3":         queue_trend_3,
                "vehicle_acceleration":  vehicle_acceleration,
                "normalized_congestion": normalized_congestion,
                "occupancy_ratio":       occupancy_ratio,
                "vehicle_ma_3":          vehicle_ma_3,
                "density_trend":         density_trend,
                "queue_to_vehicle_ratio": round(
                    queue_length / max(vehicle_count, 1), 4
                ),
                "density_normalized": round(density / 10.0, 4),  # Scale to 0-1
            })
        
        df = pd.DataFrame(rows)
        return df

    def augment_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        ✅ IMPROVEMENT #5: Data Augmentation
        Generate synthetic traffic scenarios
        """
        augmented_rows = []
        
        for idx in range(len(df)):
            row = df.iloc[idx].copy()
            
            # Scenario 1: +10% traffic (minor congestion increase)
            aug1 = row.copy()
            aug1['vehicle_count'] = int(min(25, row['vehicle_count'] * 1.1))
            aug1['queue_length'] = min(12, row['queue_length'] * 1.1)
            aug1['density'] = min(12, row['density'] * 1.1)
            aug1['normalized_congestion'] = min(1.0, row['normalized_congestion'] * 1.1)
            augmented_rows.append(aug1)
            
            # Scenario 2: -10% traffic (lighter traffic)
            aug2 = row.copy()
            aug2['vehicle_count'] = max(0, int(row['vehicle_count'] * 0.9))
            aug2['queue_length'] = max(0, row['queue_length'] * 0.9)
            aug2['density'] = max(0, row['density'] * 0.9)
            augmented_rows.append(aug2)
            
            # Scenario 3: Peak congestion (1.5x traffic)
            if idx % 3 == 0:  # Only for some rows
                aug3 = row.copy()
                aug3['vehicle_count'] = int(min(25, row['vehicle_count'] * 1.5))
                aug3['queue_length'] = min(12, row['queue_length'] * 1.5)
                aug3['density'] = min(12, row['density'] * 1.5)
                aug3['normalized_congestion'] = min(1.0, row['normalized_congestion'] * 1.3)
                augmented_rows.append(aug3)
        
        # Combine original + augmented
        augmented_df = pd.concat(
            [df, pd.DataFrame(augmented_rows)],
            ignore_index=True
        )
        return augmented_df

    def _estimate_queue(self, detections: list) -> int:
        """Count vehicles that are close together (queued)"""
        if len(detections) < 2:
            return len(detections)
        centers = [d["center"] for d in detections]
        queued = 0
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

    def _get_category(self, vehicle_count: int) -> str:
        """Traffic category based on vehicle count"""
        if vehicle_count <= 5:
            return "LOW"
        elif vehicle_count <= 15:
            return "MEDIUM"
        else:
            return "HIGH"

    def save_features(self, df: pd.DataFrame, lane_name: str, augmented: bool = False):
        """Save features to CSV"""
        suffix = "_augmented" if augmented else ""
        out_path = PROCESSED_DIR / f"{lane_name}_features{suffix}.csv"
        df.to_csv(out_path, index=False)
        print(f"Saved: {out_path} — {len(df)} rows")
        return out_path

    def load_features(self, lane_name: str, augmented: bool = False) -> pd.DataFrame:
        """Load features from CSV"""
        suffix = "_augmented" if augmented else ""
        path = PROCESSED_DIR / f"{lane_name}_features{suffix}.csv"
        if not path.exists():
            raise FileNotFoundError(f"No features for lane: {lane_name}")
        return pd.read_csv(path)

    def load_all_lanes(self, augmented: bool = False) -> pd.DataFrame:
        """Load features from all lanes"""
        dfs = []
        for lane in LANES:
            suffix = "_augmented" if augmented else ""
            path = PROCESSED_DIR / f"{lane}_features{suffix}.csv"
            if path.exists():
                dfs.append(pd.read_csv(path))
        if not dfs:
            raise FileNotFoundError("No CSVs found!")
        return pd.concat(dfs, ignore_index=True)


if __name__ == "__main__":
    afe = AdvancedFeatureExtractor()
    print("✅ AdvancedFeatureExtractor ready!")
    print("Output dir:", PROCESSED_DIR)
    print("\nFeatures extracted:")
    print("- Original: 9 features")
    print("- Advanced: 9 features")
    print("- Total: 18 features")
    print("\nAugmentation available:")
    print("- Scenario 1: +10% traffic")
    print("- Scenario 2: -10% traffic")
    print("- Scenario 3: +50% traffic (peak)")
