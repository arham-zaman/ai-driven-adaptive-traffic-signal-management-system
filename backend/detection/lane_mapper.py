import numpy as np
import cv2
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.config import LANES

class LaneMapper:
    def __init__(self, frame_width=1280, frame_height=720):
        self.fw = frame_width
        self.fh = frame_height
        self.zones = self._define_zones()

    def _define_zones(self):
        """
        Divide frame into 4 lane zones for a 4-way intersection
        
        +------------------+------------------+
        |                  |                  |
        |     NORTH        |      EAST        |
        |                  |                  |
        +------------------+------------------+
        |                  |                  |
        |     SOUTH        |      WEST        |
        |                  |                  |
        +------------------+------------------+
        """
        hw = self.fw // 2   # half width
        hh = self.fh // 2   # half height

        return {
            "north": (0,   0,  hw,  hh),   # x1,y1,x2,y2
            "east":  (hw,  0,  self.fw, hh),
            "south": (0,  hh,  hw,  self.fh),
            "west":  (hw, hh,  self.fw, self.fh),
        }

    def get_lane(self, center_x, center_y) -> str:
        """Return lane name for a given vehicle center point"""
        for lane, (x1, y1, x2, y2) in self.zones.items():
            if x1 <= center_x < x2 and y1 <= center_y < y2:
                return lane
        return "unknown"

    def assign_lanes(self, detections: list) -> list:
        """Add lane info to each detection"""
        for d in detections:
            cx, cy = d["center"]
            d["lane"] = self.get_lane(cx, cy)
        return detections

    def count_per_lane(self, detections: list) -> dict:
        """Return vehicle count per lane"""
        counts = {lane: 0 for lane in LANES}
        for d in detections:
            lane = d.get("lane", self.get_lane(*d["center"]))
            if lane in counts:
                counts[lane] += 1
        return counts

    def draw_zones(self, frame):
        """Draw lane zones on frame — useful for testing/visualization"""
        colors = {
            "north": (255, 0,   0),    # blue
            "east":  (0,   255, 0),    # green
            "south": (0,   0,   255),  # red
            "west":  (255, 255, 0),    # cyan
        }
        for lane, (x1, y1, x2, y2) in self.zones.items():
            cv2.rectangle(frame, (x1, y1), (x2, y2), colors[lane], 2)
            cv2.putText(frame, lane.upper(), (x1+10, y1+30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, colors[lane], 2)
        return frame

    def update_zones(self, custom_zones: dict):
        """
        Override default zones with custom ones
        custom_zones = {
            'north': (x1, y1, x2, y2),
            ...
        }
        """
        self.zones.update(custom_zones)
        print("Zones updated:", self.zones)


if __name__ == "__main__":
    mapper = LaneMapper()
    print("LaneMapper ready!")
    print("Zones:")
    for lane, zone in mapper.zones.items():
        print(f"  {lane}: {zone}")

    # Test
    test_point = (300, 200)
    lane = mapper.get_lane(*test_point)
    print(f"\nPoint {test_point} belongs to lane: {lane}")