"""
Emergency Override Module
Allows manual control of traffic signals in emergency situations
"""
import time
import threading
from typing import Optional
from datetime import datetime


class EmergencyOverride:
    """
    Handles emergency vehicle detection and signal override
    - Ambulance / Fire truck / Police → Green signal priority
    - Manual override via API
    - Auto-reset after emergency clears
    """

    def __init__(self):
        self.active_overrides: dict = {}   # lane → override info
        self.override_history: list = []
        self._lock = threading.Lock()
        self.AUTO_RESET_SECONDS = 30       # auto-reset after 30s

    # ── Activate Override ─────────────────────────────────────
    def activate(self, lane: str, reason: str = "EMERGENCY",
                 duration: int = 30) -> dict:
        """
        Activate emergency override for a lane
        Args:
            lane:     Lane name (north/south/east/west)
            reason:   Reason (AMBULANCE / FIRE / POLICE / MANUAL)
            duration: Override duration in seconds
        """
        with self._lock:
            override_info = {
                "lane":       lane,
                "reason":     reason,
                "activated":  datetime.now().isoformat(),
                "duration":   duration,
                "expires_at": (datetime.now().timestamp() + duration),
                "status":     "ACTIVE"
            }
            self.active_overrides[lane] = override_info
            self.override_history.append(override_info)

            # Auto-reset timer
            timer = threading.Timer(duration, self._auto_reset, args=[lane])
            timer.daemon = True
            timer.start()

        print(f"[EMERGENCY] Override ACTIVATED — Lane: {lane} | "
              f"Reason: {reason} | Duration: {duration}s")

        return {"success": True, "override": override_info}

    # ── Deactivate Override ───────────────────────────────────
    def deactivate(self, lane: str) -> dict:
        """Manually deactivate override for a lane"""
        with self._lock:
            if lane not in self.active_overrides:
                return {"success": False,
                        "message": f"No active override for lane: {lane}"}

            override = self.active_overrides.pop(lane)
            override["status"]       = "DEACTIVATED"
            override["deactivated"]  = datetime.now().isoformat()

        print(f"[EMERGENCY] Override DEACTIVATED — Lane: {lane}")
        return {"success": True, "override": override}

    # ── Check Override ────────────────────────────────────────
    def is_active(self, lane: str) -> bool:
        """Check if emergency override is active for a lane"""
        with self._lock:
            if lane not in self.active_overrides:
                return False
            override = self.active_overrides[lane]
            # Check if expired
            if datetime.now().timestamp() > override["expires_at"]:
                self.active_overrides.pop(lane)
                return False
            return True

    def get_status(self, lane: Optional[str] = None) -> dict:
        """Get current override status"""
        with self._lock:
            if lane:
                if lane in self.active_overrides:
                    return {"active": True,
                            "override": self.active_overrides[lane]}
                return {"active": False, "lane": lane}

            return {
                "active_overrides": list(self.active_overrides.values()),
                "total_active":     len(self.active_overrides),
                "history_count":    len(self.override_history)
            }

    def get_green_time(self, lane: str,
                       normal_green_time: int) -> int:
        """
        Get green time — returns MAX if emergency override active
        """
        if self.is_active(lane):
            print(f"[EMERGENCY] Lane {lane} → MAX green time (60s)")
            return 60   # Maximum green time for emergency
        return normal_green_time

    # ── Auto Reset ────────────────────────────────────────────
    def _auto_reset(self, lane: str):
        """Auto-reset override after duration expires"""
        with self._lock:
            if lane in self.active_overrides:
                self.active_overrides.pop(lane)
                print(f"[EMERGENCY] Override AUTO-RESET — Lane: {lane}")

    def deactivate_all(self) -> dict:
        """Deactivate all active overrides"""
        with self._lock:
            count = len(self.active_overrides)
            self.active_overrides.clear()
        print(f"[EMERGENCY] ALL overrides deactivated ({count} lanes)")
        return {"success": True, "deactivated_count": count}


# ── Singleton ─────────────────────────────────────────────────
emergency_override = EmergencyOverride()


if __name__ == "__main__":
    em = EmergencyOverride()

    # Test
    print("Testing Emergency Override...")
    em.activate("north", "AMBULANCE", duration=10)
    print(f"North active: {em.is_active('north')}")
    print(f"Green time:   {em.get_green_time('north', 25)}s")
    print(f"Status: {em.get_status()}")

    em.deactivate("north")
    print(f"North active after deactivate: {em.is_active('north')}")
    print("Test complete!")