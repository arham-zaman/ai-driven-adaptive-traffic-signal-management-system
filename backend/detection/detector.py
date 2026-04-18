import cv2
from ultralytics import YOLO
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import (
    YOLO_MODEL, FRAME_SKIP, CONFIDENCE_THRESHOLD, VEHICLE_CLASSES
)

class VehicleDetector:
    def __init__(self):
        print("Loading YOLOv8 model...")
        self.model = YOLO(YOLO_MODEL)
        print("Model loaded!")

    def detect_frame(self, frame):
        """Detect vehicles in a single frame — returns list of detections"""
        results = self.model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                if cls in VEHICLE_CLASSES:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    detections.append({
                        "class": cls,
                        "confidence": round(conf, 2),
                        "bbox": [x1, y1, x2, y2],
                        "width": x2 - x1,
                        "height": y2 - y1,
                        "center": ((x1 + x2) // 2, (y1 + y2) // 2)
                    })
        return detections

    def process_video(self, video_path, lane_name="north", save_output=False):
        """Process full video — returns per-frame stats"""
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"Video: {video_path}")
        print(f"FPS: {fps}, Total frames: {total_frames}")

        frame_data = []
        frame_num = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_num % FRAME_SKIP == 0:
                detections = self.detect_frame(frame)
                vehicle_count = len(detections)

                frame_data.append({
                    "frame": frame_num,
                    "time_sec": round(frame_num / fps, 2),
                    "lane": lane_name,
                    "vehicle_count": vehicle_count,
                    "detections": detections
                })

                print(f"Frame {frame_num}/{total_frames} — Vehicles: {vehicle_count}")

            frame_num += 1

        cap.release()
        print(f"Done! Processed {len(frame_data)} frames.")
        return frame_data


if __name__ == "__main__":
    detector = VehicleDetector()
    print("Detector ready!")
    print("Vehicle classes:", VEHICLE_CLASSES)