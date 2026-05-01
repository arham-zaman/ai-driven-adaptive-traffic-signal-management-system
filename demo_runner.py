"""
demo_runner.py — AI Traffic Signal Demo
========================================
Yeh file 4 videos ko simultaneously process karti hai:
1. YOLO se vehicle detection
2. Features extract
3. FastAPI ko predictions bhejti hai
4. Signal controller update hota hai
5. Dashboard real-time update dikhata hai

Usage:
    python demo_runner.py                    # default: north/south/east/west videos
    python demo_runner.py --lanes north      # sirf ek lane
    python demo_runner.py --speed 2          # 2x speed

Requirements: Backend must be running → uvicorn backend.api.main:app --reload
"""

import sys
import time
import threading
import argparse
import requests
import cv2
import numpy as np
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backend.config import (
    RAW_VIDEOS_DIR, CONFIDENCE_THRESHOLD, VEHICLE_CLASSES,
    YOLO_MODEL, FRAME_SKIP, LANES
)

API_BASE = "http://localhost:8000"

# ── Colors for terminal output ────────────────────────────────
class C:
    CYAN   = "\033[96m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"
    PURPLE = "\033[95m"

# ── Lane → Video mapping ──────────────────────────────────────
LANE_VIDEO_MAP = {
    "north": "north.mp4",
    "south": "South.mp4",
    "east":  "East.mp4",
    "west":  "West.mp4",
}

# ─────────────────────────────────────────────────────────────
def check_backend():
    """Backend connected hai ya nahi check karo"""
    try:
        r = requests.get(f"{API_BASE}/", timeout=3)
        return r.status_code == 200
    except:
        return False

# ─────────────────────────────────────────────────────────────
def send_traffic_data(lane: str, vehicle_count: int, queue_length: float,
                       density: float, congestion_ratio: float, count_change: int):
    """Backend ko traffic data bhejo aur prediction lo"""
    try:
        params = {
            "lane":             lane,
            "vehicle_count":    vehicle_count,
            "queue_length":     queue_length,
            "density":          round(density, 4),
            "congestion_ratio": round(congestion_ratio, 4),
            "count_change":     count_change,
        }
        r = requests.post(f"{API_BASE}/predictions/predict", params=params, timeout=5)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        pass
    return None

# ─────────────────────────────────────────────────────────────
def send_traffic_log(lane: str, vehicle_count: int, queue_length: float,
                      avg_speed: float, density: float):
    """Traffic log database mein save karo"""
    try:
        params = {
            "lane":          lane,
            "vehicle_count": vehicle_count,
            "queue_length":  queue_length,
            "avg_speed":     avg_speed,
            "density":       round(density, 4),
        }
        requests.post(f"{API_BASE}/logs/add", params=params, timeout=3)
    except:
        pass

# ─────────────────────────────────────────────────────────────
def estimate_queue(detections: list) -> int:
    """Vehicles jo close hain unko queued count karo"""
    if len(detections) < 2:
        return len(detections)
    centers = [(d["center_x"], d["center_y"]) for d in detections]
    queued = 0
    for i, c1 in enumerate(centers):
        for j, c2 in enumerate(centers):
            if i != j:
                dist = ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2) ** 0.5
                if dist < 80:
                    queued += 1
                    break
    return queued

# ─────────────────────────────────────────────────────────────
def process_lane_video(lane: str, video_path: Path, model,
                        speed_multiplier: float = 1.0,
                        results_store: dict = None,
                        stop_event: threading.Event = None):
    """
    Ek lane ka video process karo — YOLO detection + API calls
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"{C.RED}[{lane.upper()}] Cannot open: {video_path}{C.RESET}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    lane_area_pixels = 50000

    print(f"{C.CYAN}[{lane.upper()}]{C.RESET} Video loaded: {video_path.name} "
          f"| {total_frames} frames | {fps:.0f}fps")

    frame_num = 0
    prev_count = 0
    prediction_interval = max(1, int(fps * 2))  # har 2 seconds mein prediction

    while not (stop_event and stop_event.is_set()):
        ret, frame = cap.read()
        if not ret:
            # Video khatam → loop karo for demo
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            frame_num = 0
            print(f"{C.YELLOW}[{lane.upper()}] Video loop restarted{C.RESET}")
            time.sleep(1)
            continue

        if frame_num % FRAME_SKIP == 0:
            # ── YOLO Detection ────────────────────────────────
            results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
            detections = []
            for r in results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    if cls in VEHICLE_CLASSES:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        detections.append({
                            "class": cls,
                            "confidence": float(box.conf[0]),
                            "center_x": (x1 + x2) // 2,
                            "center_y": (y1 + y2) // 2,
                            "width":  x2 - x1,
                            "height": y2 - y1,
                        })

            vehicle_count  = len(detections)
            queue_length   = estimate_queue(detections)
            total_area     = sum(d["width"] * d["height"] for d in detections)
            density        = round(total_area / lane_area_pixels, 4)
            congestion     = round(min(1.0, queue_length / max(vehicle_count, 1)), 4)
            count_change   = abs(vehicle_count - prev_count)

            # ── Store real-time data ──────────────────────────
            if results_store is not None:
                results_store[lane] = {
                    "vehicle_count":    vehicle_count,
                    "queue_length":     queue_length,
                    "density":          density,
                    "congestion_ratio": congestion,
                    "frame":            frame_num,
                    "total_frames":     total_frames,
                }

            # ── Send prediction to API (every 2s) ────────────
            if frame_num % prediction_interval == 0:
                pred = send_traffic_data(
                    lane, vehicle_count, queue_length,
                    density, congestion, count_change
                )
                # Log to database
                send_traffic_log(lane, vehicle_count, queue_length, 20.0, density)

                if pred:
                    cat   = pred.get("traffic_category", "—")
                    gt    = pred.get("predicted_green_time", "—")
                    conf  = pred.get("classifier_confidence", "—")
                    color = C.GREEN if cat == "LOW" else C.YELLOW if cat == "MEDIUM" else C.RED

                    print(f"{C.CYAN}[{lane.upper()}]{C.RESET} "
                          f"Frame {frame_num:4d} | "
                          f"Vehicles: {C.BOLD}{vehicle_count:2d}{C.RESET} | "
                          f"Queue: {queue_length:2d} | "
                          f"Category: {color}{cat}{C.RESET} | "
                          f"Green Time: {C.GREEN}{gt}s{C.RESET} | "
                          f"Conf: {conf}%")
                else:
                    print(f"{C.CYAN}[{lane.upper()}]{C.RESET} "
                          f"Frame {frame_num:4d} | "
                          f"Vehicles: {C.BOLD}{vehicle_count:2d}{C.RESET} | "
                          f"Queue: {queue_length} | "
                          f"{C.YELLOW}(API not responding — is backend running?){C.RESET}")

            prev_count = vehicle_count

        frame_num += 1

        # Speed control — demo slow karo taake dashboard pe dikhe
        sleep_time = (FRAME_SKIP / fps) / speed_multiplier
        time.sleep(max(0.01, sleep_time))

    cap.release()
    print(f"{C.YELLOW}[{lane.upper()}] Processing stopped.{C.RESET}")

# ─────────────────────────────────────────────────────────────
def start_signal_timer(lane_counts: dict):
    """Backend signal timer start karo"""
    try:
        params = {k: str(v) for k, v in lane_counts.items()}
        r = requests.post(f"{API_BASE}/control/timer/start", params=params, timeout=5)
        if r.status_code == 200:
            print(f"{C.GREEN}Signal timer started on backend!{C.RESET}")
            return True
    except Exception as e:
        print(f"{C.YELLOW}Could not start signal timer: {e}{C.RESET}")
    return False

# ─────────────────────────────────────────────────────────────
def print_status_loop(results_store: dict, stop_event: threading.Event):
    """Har 5 second mein summary print karo"""
    while not stop_event.is_set():
        time.sleep(5)
        if not results_store:
            continue
        print(f"\n{C.PURPLE}{'='*60}{C.RESET}")
        print(f"{C.BOLD}  LIVE TRAFFIC SUMMARY{C.RESET}")
        print(f"{C.PURPLE}{'='*60}{C.RESET}")
        for lane, data in results_store.items():
            count = data.get("vehicle_count", 0)
            cat   = "LOW" if count <= 5 else "MEDIUM" if count <= 15 else "HIGH"
            color = C.GREEN if cat == "LOW" else C.YELLOW if cat == "MEDIUM" else C.RED
            print(f"  {C.CYAN}{lane.upper():6}{C.RESET} | "
                  f"Vehicles: {C.BOLD}{count:2d}{C.RESET} | "
                  f"Queue: {data.get('queue_length',0):2d} | "
                  f"Category: {color}{cat}{C.RESET}")
        print(f"{C.PURPLE}{'='*60}{C.RESET}\n")

# ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="AI Traffic Signal Demo Runner"
    )
    parser.add_argument(
        "--lanes", nargs="+",
        default=["north", "south", "east", "west"],
        choices=["north", "south", "east", "west"],
        help="Which lanes to run (default: all 4)"
    )
    parser.add_argument(
        "--speed", type=float, default=1.0,
        help="Speed multiplier (e.g., 2.0 = 2x faster, 0.5 = slower)"
    )
    args = parser.parse_args()

    print(f"\n{C.BOLD}{C.CYAN}{'='*60}")
    print("  AI ADAPTIVE TRAFFIC SIGNAL — DEMO RUNNER")
    print(f"{'='*60}{C.RESET}")
    print(f"  Lanes: {args.lanes}")
    print(f"  Speed: {args.speed}x")
    print(f"  Backend: {API_BASE}")
    print()

    # ── Check backend ─────────────────────────────────────────
    print("Checking backend connection...", end=" ", flush=True)
    if check_backend():
        print(f"{C.GREEN}CONNECTED ✓{C.RESET}")
    else:
        print(f"{C.RED}NOT CONNECTED ✗{C.RESET}")
        print(f"\n{C.YELLOW}Please start the backend first:{C.RESET}")
        print("  uvicorn backend.api.main:app --reload --port 8000")
        print("\nContinuing anyway (data won't be sent to dashboard)...\n")

    # ── Check videos ──────────────────────────────────────────
    lanes_to_run = []
    for lane in args.lanes:
        video_name = LANE_VIDEO_MAP.get(lane)
        video_path = RAW_VIDEOS_DIR / video_name if video_name else None
        if video_path and video_path.exists():
            lanes_to_run.append((lane, video_path))
            print(f"  {C.GREEN}✓{C.RESET} {lane.upper():6} → {video_name}")
        else:
            print(f"  {C.RED}✗{C.RESET} {lane.upper():6} → {video_name} (NOT FOUND — skipping)")

    if not lanes_to_run:
        print(f"\n{C.RED}No videos found! Check RAW_VIDEOS_DIR: {RAW_VIDEOS_DIR}{C.RESET}")
        return

    print(f"\nLoading YOLOv8 model ({YOLO_MODEL})...", end=" ", flush=True)
    try:
        from ultralytics import YOLO
        model = YOLO(YOLO_MODEL)
        print(f"{C.GREEN}LOADED ✓{C.RESET}")
    except Exception as e:
        print(f"{C.RED}FAILED: {e}{C.RESET}")
        return

    print(f"\n{C.GREEN}Starting demo... Open dashboard at http://localhost:5173{C.RESET}")
    print(f"{C.YELLOW}Press Ctrl+C to stop{C.RESET}\n")

    # ── Start signal timer on backend ─────────────────────────
    start_signal_timer({lane: 5 for lane, _ in lanes_to_run})

    # ── Shared results store ──────────────────────────────────
    results_store = {}
    stop_event    = threading.Event()

    # ── Start threads for each lane ───────────────────────────
    threads = []
    for lane, video_path in lanes_to_run:
        t = threading.Thread(
            target=process_lane_video,
            args=(lane, video_path, model, args.speed, results_store, stop_event),
            daemon=True,
            name=f"Lane-{lane}"
        )
        t.start()
        threads.append(t)
        time.sleep(0.3)  # Stagger start times slightly

    # ── Status printer thread ─────────────────────────────────
    status_thread = threading.Thread(
        target=print_status_loop,
        args=(results_store, stop_event),
        daemon=True
    )
    status_thread.start()

    # ── Wait for Ctrl+C ───────────────────────────────────────
    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print(f"\n{C.YELLOW}Stopping demo...{C.RESET}")
        stop_event.set()
        time.sleep(2)

    # ── Stop signal timer ─────────────────────────────────────
    try:
        requests.post(f"{API_BASE}/control/timer/stop", timeout=3)
        print(f"{C.GREEN}Signal timer stopped.{C.RESET}")
    except:
        pass

    print(f"\n{C.BOLD}{C.CYAN}Demo finished!{C.RESET}")
    print("Logs saved in database — check Logs page on dashboard.")


if __name__ == "__main__":
    main()