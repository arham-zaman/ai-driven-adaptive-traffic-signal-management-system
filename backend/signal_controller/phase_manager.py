import time
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import (
    LANES, MIN_GREEN_TIME, MAX_GREEN_TIME, 
    YELLOW_TIME, DEFAULT_CYCLE
)

class PhaseManager:
    def __init__(self):
        self.current_green_lane = LANES[0]  # start with north
        self.signal_states = {lane: "red" for lane in LANES}
        self.signal_states[self.current_green_lane] = "green"
        self.phase_index = 0
        self.is_manual = False
        self.manual_lane = None
        self.phase_history = []

    def get_states(self) -> dict:
        """Return current signal states for all lanes"""
        return self.signal_states.copy()

    def calculate_green_time(self, lane_counts: dict) -> dict:
        """
        Adaptive green time based on vehicle count per lane
        More vehicles = more green time
        """
        total_vehicles = sum(lane_counts.values())
        green_times = {}

        for lane in LANES:
            count = lane_counts.get(lane, 0)
            if total_vehicles == 0:
                green_times[lane] = DEFAULT_CYCLE
            else:
                ratio = count / total_vehicles
                green_time = MIN_GREEN_TIME + (ratio * (MAX_GREEN_TIME - MIN_GREEN_TIME))
                green_times[lane] = round(green_time, 1)

        return green_times

    def next_phase(self, lane_counts: dict = None) -> dict:
        """
        Move to next lane in cycle
        Returns: current phase info
        """
        if self.is_manual:
            return self._get_phase_info()

        # Set all to red first
        self.signal_states = {lane: "red" for lane in LANES}

        # Move to next lane
        self.phase_index = (self.phase_index + 1) % len(LANES)
        self.current_green_lane = LANES[self.phase_index]
        self.signal_states[self.current_green_lane] = "green"

        # Calculate green time
        green_times = {}
        if lane_counts:
            green_times = self.calculate_green_time(lane_counts)
        else:
            green_times = {lane: DEFAULT_CYCLE for lane in LANES}

        phase_info = {
            "green_lane":   self.current_green_lane,
            "states":       self.signal_states.copy(),
            "green_time":   green_times.get(self.current_green_lane, DEFAULT_CYCLE),
            "yellow_time":  YELLOW_TIME,
            "is_manual":    False,
            "timestamp":    time.time()
        }

        self.phase_history.append(phase_info)
        return phase_info

    def set_yellow(self):
        """Set current green lane to yellow before switching"""
        if self.current_green_lane:
            self.signal_states[self.current_green_lane] = "yellow"
        return self.signal_states.copy()

    def manual_override(self, lane: str, green_time: float = None):
        """
        Manually set a specific lane to green
        Used by dashboard manual control page
        """
        if lane not in LANES:
            raise ValueError(f"Invalid lane: {lane}. Must be one of {LANES}")

        self.is_manual = True
        self.manual_lane = lane
        self.signal_states = {l: "red" for l in LANES}
        self.signal_states[lane] = "green"
        self.current_green_lane = lane

        phase_info = {
            "green_lane":  lane,
            "states":      self.signal_states.copy(),
            "green_time":  green_time or DEFAULT_CYCLE,
            "yellow_time": YELLOW_TIME,
            "is_manual":   True,
            "timestamp":   time.time()
        }
        self.phase_history.append(phase_info)
        print(f"Manual override: {lane} is now GREEN")
        return phase_info

    def release_manual(self):
        """Release manual control — go back to adaptive mode"""
        self.is_manual = False
        self.manual_lane = None
        print("Manual control released — back to adaptive mode")

    def emergency_all_red(self):
        """Set all signals to red — emergency stop"""
        self.signal_states = {lane: "red" for lane in LANES}
        self.is_manual = True
        print("EMERGENCY: All signals RED")
        return self.signal_states.copy()

    def _get_phase_info(self) -> dict:
        return {
            "green_lane":  self.current_green_lane,
            "states":      self.signal_states.copy(),
            "green_time":  DEFAULT_CYCLE,
            "yellow_time": YELLOW_TIME,
            "is_manual":   self.is_manual,
            "timestamp":   time.time()
        }


if __name__ == "__main__":
    pm = PhaseManager()
    print("Initial states:", pm.get_states())

    # Simulate adaptive cycle
    lane_counts = {"north": 10, "south": 3, "east": 7, "west": 1}
    green_times = pm.calculate_green_time(lane_counts)
    print("\nAdaptive green times:", green_times)

    phase = pm.next_phase(lane_counts)
    print("\nNext phase:", phase["green_lane"], "| Green time:", phase["green_time"])

    # Test manual override
    pm.manual_override("east", green_time=45)
    print("After manual override:", pm.get_states())