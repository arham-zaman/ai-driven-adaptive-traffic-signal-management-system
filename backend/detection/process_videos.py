import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import RAW_VIDEOS_DIR, PROCESSED_DIR
from backend.detection.detector import VehicleDetector
from backend.detection.feature_extractor import FeatureExtractor

# ─── Video to Lane mapping ─────────────────────────────────────
VIDEO_LANE_MAP = {
    "north.mp4":    "north",
    "South.mp4":    "south",
    "East.mp4":     "east",
    "West.mp4":     "west",
    "Traffic3.mp4": "traffic3",
    "Traffic4.mp4": "traffic4",
    "Traffic7.mp4": "traffic7",
    "Traffic8.mp4": "traffic8",
}

def process_all_videos():
    detector  = VehicleDetector()
    extractor = FeatureExtractor()

    print(f"\nFound videos in: {RAW_VIDEOS_DIR}")
    print("="*50)

    for video_file, lane_name in VIDEO_LANE_MAP.items():
        video_path = RAW_VIDEOS_DIR / video_file

        if not video_path.exists():
            print(f"SKIP: {video_file} not found")
            continue

        print(f"\nProcessing: {video_file} → lane: {lane_name}")
        print("-"*40)

        # Step 1: Detect vehicles
        frame_data = detector.process_video(video_path, lane_name)

        if not frame_data:
            print(f"No frames processed for {video_file}")
            continue

        # Step 2: Extract features
        df = extractor.extract_features(frame_data, lane_name)

        # Step 3: Save to CSV
        extractor.save_features(df, lane_name)

        print(f"Done: {lane_name} — {len(df)} frames, "
              f"avg vehicles: {df['vehicle_count'].mean():.1f}")

    print("\n" + "="*50)
    print("All videos processed!")
    print(f"CSVs saved in: {PROCESSED_DIR}")

if __name__ == "__main__":
    process_all_videos()