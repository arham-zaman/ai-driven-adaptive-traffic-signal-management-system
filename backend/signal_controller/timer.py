import time
import threading
import numpy as np
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import LANES, YELLOW_TIME, MIN_GREEN_TIME, MAX_GREEN_TIME
from backend.signal_controller.phase_manager import PhaseManager

class SignalTimer:
    def __init__(self, phase_manager: PhaseManager):
        self.pm              = phase_manager
        self.running         = False
        self.thread          = None
        self.current_green_time = 0
        self.time_remaining  = 0
        self.on_phase_change = None
        self.on_tick         = None
        self._lock           = threading.Lock()
        self._lane_features  = {}

    # ─── Public API ───────────────────────────────────────────

    def start(self, lane_counts: dict = None):
        if self.running:
            print("Timer already running!")
            return
        self.running = True
        self.thread  = threading.Thread(
            target=self._run_cycle,
            args=(lane_counts,),
            daemon=True
        )
        self.thread.start()
        print("Signal timer started — AI adaptive mode!")

    def stop(self):
        self.running = False
        print("Signal timer stopped!")

    def update_lane_features(self, lane: str, vehicle_count: float,
                              queue_length: float, density: float,
                              congestion_ratio: float):
        """
        ✅ FIXED: Called by detection pipeline to update latest traffic data.
        Timer uses this for AI prediction.
        """
        with self._lock:
            self._lane_features[lane] = {
                "vehicle_count":    vehicle_count,
                "queue_length":     queue_length,
                "density":          density,
                "congestion_ratio": congestion_ratio
            }

    def update_counts(self, lane_counts: dict):
        """Backward compatible — update vehicle counts"""
        with self._lock:
            for lane, count in lane_counts.items():
                if lane not in self._lane_features:
                    self._lane_features[lane] = {
                        "vehicle_count":    count,
                        "queue_length":     count * 0.8,
                        "density":          min(count / 20.0, 1.0),
                        "congestion_ratio": min(1.0, (count * 0.8) / max(count, 1))
                    }
                else:
                    self._lane_features[lane]["vehicle_count"] = count

    def get_status(self) -> dict:
        with self._lock:
            return {
                "running":        self.running,
                "green_lane":     self.pm.current_green_lane,
                "states":         self.pm.get_states(),
                "time_remaining": self.time_remaining,
                "is_manual":      self.pm.is_manual
            }

    # ─── Internal cycle ───────────────────────────────────────

    def _get_ai_green_time(self, lane: str) -> float:
        """
        ✅ FIXED: Lock properly managed — extended until features used!
        Use AI pipeline to get green time for this lane.
        Falls back to simple formula if models not available.
        """
        try:
            # ── Get features safely ────────────────────────────
            with self._lock:
                features = dict(self._lane_features.get(lane, {}))

            if not features:
                features = {
                    "vehicle_count":    5,
                    "queue_length":     2,
                    "density":          0.5,
                    "congestion_ratio": 0.4
                }

            vehicle_count    = features.get("vehicle_count", 5)
            queue_length     = features.get("queue_length", 2)
            density          = features.get("density", 0.5)
            congestion_ratio = features.get("congestion_ratio", 0.4)

            # ── Try GRU model first ────────────────────────────
            from backend.models.gru_model import GRUModel
            gru = GRUModel()
            gru.load()
            current  = np.array([[vehicle_count, queue_length,
                                   density, congestion_ratio]])
            from backend.config import SEQUENCE_LENGTH
            sequence = np.repeat(current, SEQUENCE_LENGTH, axis=0)
            gru_time = gru.predict(sequence)

            # ── Try classifier for category check ─────────────
            from backend.models.xgboost_classifier import XGBoostClassifier
            xgb      = XGBoostClassifier()
            xgb.load()
            clf_feat = np.array([queue_length, density, congestion_ratio, 1])
            clf_result  = xgb.predict_green_time(clf_feat)
            clf_time    = clf_result["green_time"]

            # ── Weighted blend: 60% GRU + 40% Classifier ──────
            final = round(0.6 * gru_time + 0.4 * clf_time, 1)
            final = float(np.clip(final, MIN_GREEN_TIME, MAX_GREEN_TIME))

            print(f"  AI prediction for {lane}: "
                  f"GRU={gru_time:.1f}s, "
                  f"Classifier={clf_time}s ({clf_result['category']}), "
                  f"Final={final}s")
            return final

        except Exception as e:
            # Fallback: simple vehicle count based formula
            print(f"  AI fallback for {lane}: {e}")
            with self._lock:
                count = self._lane_features.get(
                    lane, {}
                ).get("vehicle_count", 5)
            if count <= 5:
                return 15.0
            elif count <= 15:
                return 30.0
            else:
                return 50.0

    def _run_cycle(self, lane_counts: dict = None):
        """Main cycle loop — uses AI for green time decisions"""

        # Initialize with provided counts
        if lane_counts:
            self.update_counts(lane_counts)

        while self.running:
            if self.pm.is_manual:
                time.sleep(1)
                continue

            # Get features snapshot
            with self._lock:
                features_snapshot = dict(self._lane_features)

            lane_counts_simple = {
                lane: features_snapshot.get(lane, {}).get("vehicle_count", 0)
                for lane in LANES
            }
            phase      = self.pm.next_phase(lane_counts_simple)
            green_lane = phase["green_lane"]

            # ── Get AI green time ──────────────────────────────
            green_time = self._get_ai_green_time(green_lane)
            self.current_green_time = green_time

            print(f"\n{'='*45}")
            print(f"  PHASE: {green_lane.upper()} GREEN for {green_time}s")
            print(f"{'='*45}")

            if self.on_phase_change:
                self.on_phase_change({**phase, "green_time": green_time})

            # ── Green countdown ────────────────────────────────
            for remaining in range(int(green_time), 0, -1):
                if not self.running or self.pm.is_manual:
                    break
                with self._lock:
                    self.time_remaining = remaining
                if self.on_tick:
                    self.on_tick({
                        "lane":      green_lane,
                        "state":     "green",
                        "remaining": remaining
                    })
                time.sleep(1)

            if not self.running:
                break

            # ── Yellow phase ───────────────────────────────────
            self.pm.set_yellow()
            print(f"  → YELLOW for {YELLOW_TIME}s")

            if self.on_phase_change:
                self.on_phase_change({
                    **phase,
                    "states": self.pm.get_states(),
                    "state":  "yellow",
                    "green_time": green_time
                })

            for remaining in range(YELLOW_TIME, 0, -1):
                if not self.running:
                    break
                with self._lock:
                    self.time_remaining = remaining
                time.sleep(1)


if __name__ == "__main__":
    pm    = PhaseManager()
    timer = SignalTimer(pm)

    # Simulate real traffic data
    timer.update_lane_features("north", vehicle_count=12,
                                queue_length=8, density=0.6, congestion_ratio=0.67)
    timer.update_lane_features("south", vehicle_count=3,
                                queue_length=2, density=0.2, congestion_ratio=0.67)
    timer.update_lane_features("east",  vehicle_count=7,
                                queue_length=5, density=0.4, congestion_ratio=0.71)
    timer.update_lane_features("west",  vehicle_count=18,
                                queue_length=12, density=0.8, congestion_ratio=0.67)

    def on_phase(phase):
        print(f"  States: {phase['states']}")

    timer.on_phase_change = on_phase
    timer.start()

    time.sleep(20)
    timer.stop()
    print("\nFinal status:", timer.get_status())