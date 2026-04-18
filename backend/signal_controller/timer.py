import time
import threading
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import LANES, YELLOW_TIME, MIN_GREEN_TIME, MAX_GREEN_TIME
from backend.signal_controller.phase_manager import PhaseManager

class SignalTimer:
    def __init__(self, phase_manager: PhaseManager):
        self.pm = phase_manager
        self.running = False
        self.thread = None
        self.current_green_time = 0
        self.time_remaining = 0
        self.on_phase_change = None   # callback function
        self.on_tick = None           # called every second

    def start(self, lane_counts: dict = None):
        """Start the adaptive signal cycle in background thread"""
        if self.running:
            print("Timer already running!")
            return
        self.running = True
        self.thread = threading.Thread(
            target=self._run_cycle,
            args=(lane_counts,),
            daemon=True
        )
        self.thread.start()
        print("Signal timer started!")

    def stop(self):
        """Stop the signal cycle"""
        self.running = False
        print("Signal timer stopped!")

    def _run_cycle(self, lane_counts: dict = None):
        """Main cycle loop — runs in background thread"""
        while self.running:
            if self.pm.is_manual:
                time.sleep(1)
                continue

            # Get next phase
            phase = self.pm.next_phase(lane_counts)
            green_time = phase["green_time"]
            self.current_green_time = green_time

            print(f"\n--- Phase: {phase['green_lane'].upper()} GREEN "
                  f"for {green_time}s ---")

            if self.on_phase_change:
                self.on_phase_change(phase)

            # Count down green time
            for remaining in range(int(green_time), 0, -1):
                if not self.running or self.pm.is_manual:
                    break
                self.time_remaining = remaining
                if self.on_tick:
                    self.on_tick({
                        "lane": phase["green_lane"],
                        "state": "green",
                        "remaining": remaining
                    })
                time.sleep(1)

            if not self.running:
                break

            # Yellow phase
            self.pm.set_yellow()
            print(f"  → YELLOW for {YELLOW_TIME}s")
            if self.on_phase_change:
                self.on_phase_change({
                    **phase,
                    "states": self.pm.get_states(),
                    "state": "yellow"
                })

            for remaining in range(YELLOW_TIME, 0, -1):
                if not self.running:
                    break
                self.time_remaining = remaining
                time.sleep(1)

    def update_counts(self, lane_counts: dict):
        """Update vehicle counts for next cycle calculation"""
        self.lane_counts = lane_counts

    def get_status(self) -> dict:
        """Return current timer status"""
        return {
            "running":       self.running,
            "green_lane":    self.pm.current_green_lane,
            "states":        self.pm.get_states(),
            "time_remaining": self.time_remaining,
            "is_manual":     self.pm.is_manual
        }


if __name__ == "__main__":
    pm = PhaseManager()
    timer = SignalTimer(pm)

    # Test with sample counts
    lane_counts = {"north": 8, "south": 2, "east": 5, "west": 4}

    def on_phase(phase):
        print(f"  States: {phase['states']}")

    timer.on_phase_change = on_phase
    timer.start(lane_counts)

    # Run for 15 seconds then stop
    time.sleep(15)
    timer.stop()
    print("\nFinal status:", timer.get_status())