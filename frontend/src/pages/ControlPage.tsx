import React, { useState, useEffect } from "react";
import { generateSnapshot, type SignalState } from "../lib/trafficData";
import TrafficLight from "../components/TrafficLight";
import { controlApi, signalsApi, LANE_DISPLAY } from "../lib/api";

type LaneOverride = { signal: SignalState; greenTime: number };

const laneKeys  = ["north", "south", "east", "west"];
const laneNames = laneKeys.map(k => LANE_DISPLAY[k]);

export default function ControlPage() {
  const [snapshot]                        = useState(generateSnapshot());
  const [overrides, setOverrides]         = useState<Record<string, LaneOverride>>({});
  const [selectedLane, setSelectedLane]   = useState(0);
  const [lastAction, setLastAction]       = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [loading, setLoading]             = useState(false);
  const [isConnected, setIsConnected]     = useState(false);

  // ── Fetch backend control status ──────────────────────────
  useEffect(() => {
    const fetchStatus = () => {
      controlApi.getStatus()
        .then(s => { setBackendStatus(s); setIsConnected(true); })
        .catch(() => setIsConnected(false));
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 2000);
    return () => clearInterval(t);
  }, []);

  const effectiveSignal = (i: number): SignalState => {
    if (backendStatus?.states) {
      const key = laneKeys[i];
      return backendStatus.states[key]?.toUpperCase() as SignalState;
    }
    return overrides[`lane-${i}`]?.signal ?? snapshot.lanes[i].signal;
  };

  const effectiveGreen = (i: number): number =>
    overrides[`lane-${i}`]?.greenTime ?? snapshot.lanes[i].timeRemaining;

  // ── Manual override → backend ──────────────────────────────
  const setSignal = async (laneIdx: number, signal: SignalState) => {
    const lane = laneKeys[laneIdx];
    setLoading(true);
    try {
      if (signal === "GREEN") {
        const greenTime = effectiveGreen(laneIdx);
        await controlApi.manualOverride(lane, greenTime);
        setLastAction(`${laneNames[laneIdx]} set to GREEN for ${greenTime}s`);
      } else if (signal === "RED") {
        await controlApi.release();
        setLastAction(`Released — AI control restored`);
      }
      setIsConnected(true);
    } catch {
      setIsConnected(false);
      setLastAction(`[DEMO] Set ${laneNames[laneIdx]} to ${signal}`);
    }
    setOverrides(prev => ({
      ...prev,
      [`lane-${laneIdx}`]: { ...prev[`lane-${laneIdx}`], signal, greenTime: prev[`lane-${laneIdx}`]?.greenTime ?? 30 },
    }));
    setLoading(false);
  };

  const setGreenTime = (laneIdx: number, t: number) => {
    setOverrides(prev => ({
      ...prev,
      [`lane-${laneIdx}`]: { ...prev[`lane-${laneIdx}`], greenTime: t, signal: prev[`lane-${laneIdx}`]?.signal ?? "GREEN" },
    }));
    setLastAction(`Green time adjusted: ${laneNames[laneIdx]} → ${t}s`);
  };

  const clearOverride = async (laneIdx: number) => {
    try {
      await controlApi.release();
      setIsConnected(true);
    } catch { setIsConnected(false); }
    const next = { ...overrides };
    delete next[`lane-${laneIdx}`];
    setOverrides(next);
    setLastAction(`Restored AI control for ${laneNames[laneIdx]}`);
  };

  const clearAll = async () => {
    try {
      await controlApi.release();
      setIsConnected(true);
    } catch { setIsConnected(false); }
    setOverrides({});
    setLastAction("All overrides cleared — AI control restored");
  };

  const handleEmergency = async () => {
    setLoading(true);
    try {
      await controlApi.emergency();
      setLastAction("⚠️ EMERGENCY — All signals RED!");
      setIsConnected(true);
    } catch {
      setIsConnected(false);
      setLastAction("[DEMO] Emergency stop activated");
    }
    setLoading(false);
  };

  const isManual = backendStatus?.is_manual ?? Object.keys(overrides).length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>CONTROL PANEL</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>
            Manual override · AI decision override
            <span style={{ marginLeft: 8, color: isConnected ? "hsl(130 100% 60%)" : "hsl(45 100% 65%)" }}>
              ● {isConnected ? "BACKEND CONNECTED" : "DEMO MODE"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleEmergency} disabled={loading} style={{
            padding: "5px 12px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            background: "hsl(0 100% 60% / 0.2)", border: "1px solid hsl(0 100% 60% / 0.5)", color: "hsl(0 100% 68%)", letterSpacing: "0.1em",
          }}>⚠️ EMERGENCY STOP</button>
          <button onClick={clearAll} disabled={loading} style={{
            padding: "5px 12px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            background: "hsl(0 100% 60% / 0.1)", border: "1px solid hsl(0 100% 60% / 0.3)", color: "hsl(0 100% 68%)", letterSpacing: "0.1em",
          }}>RESTORE ALL AI</button>
        </div>
      </div>

      {/* Mode status */}
      <div style={{
        background: isManual ? "hsl(50 100% 55% / 0.08)" : "hsl(120 100% 50% / 0.08)",
        border: `1px solid ${isManual ? "hsl(50 100% 55% / 0.3)" : "hsl(120 100% 50% / 0.3)"}`,
        borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ fontSize: 20 }}>{isManual ? "⚠️" : "🤖"}</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: isManual ? "hsl(45 100% 65%)" : "hsl(130 100% 60%)", letterSpacing: "0.1em" }}>
            {isManual ? "MANUAL MODE ACTIVE" : "AUTONOMOUS AI MODE — ALL LANES"}
          </div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>
            {lastAction ?? "No recent manual actions"}
          </div>
        </div>
      </div>

      {/* Lane selector */}
      <div style={{ display: "flex", gap: 8 }}>
        {laneNames.map((name, i) => (
          <button key={i} onClick={() => setSelectedLane(i)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
            background: selectedLane === i ? "hsl(195 100% 50% / 0.15)" : "hsl(222 35% 13%)",
            border: `1px solid ${selectedLane === i ? "hsl(195 100% 50% / 0.5)" : "hsl(220 40% 22%)"}`,
            color: selectedLane === i ? "hsl(185 100% 70%)" : "hsl(220 25% 66%)",
            fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textAlign: "center" as const,
          }}>
            {name}
            {overrides[`lane-${i}`] && <div style={{ fontSize: 8, color: "hsl(45 100% 65%)", marginTop: 2 }}>OVERRIDE</div>}
          </button>
        ))}
      </div>

      {/* Main control */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 10, color: "hsl(185 80% 68%)", letterSpacing: "0.1em", fontWeight: 600 }}>CURRENT STATE</div>
          <TrafficLight signal={effectiveSignal(selectedLane)} label={laneNames[selectedLane]} timeRemaining={effectiveGreen(selectedLane)} />
        </div>

        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 16 }}>
            CONTROL — {laneNames[selectedLane].toUpperCase()}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>SET SIGNAL STATE</div>
            <div style={{ display: "flex", gap: 10 }}>
              {(["GREEN", "YELLOW", "RED"] as SignalState[]).map(sig => (
                <button key={sig} onClick={() => setSignal(selectedLane, sig)} disabled={loading} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                  background: effectiveSignal(selectedLane) === sig
                    ? sig === "GREEN" ? "hsl(120 100% 50% / 0.2)" : sig === "RED" ? "hsl(0 100% 60% / 0.2)" : "hsl(50 100% 55% / 0.2)"
                    : "hsl(222 38% 10%)",
                  border: `1px solid ${effectiveSignal(selectedLane) === sig
                    ? sig === "GREEN" ? "hsl(120 100% 50% / 0.6)" : sig === "RED" ? "hsl(0 100% 60% / 0.6)" : "hsl(50 100% 55% / 0.6)"
                    : "hsl(220 40% 24%)"}`,
                  color: sig === "GREEN" ? "hsl(130 100% 60%)" : sig === "RED" ? "hsl(0 100% 68%)" : "hsl(45 100% 65%)",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                }}>{sig}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.1em", fontWeight: 600 }}>ADJUST GREEN TIME</div>
              <span style={{ fontFamily: "monospace", fontSize: 16, color: "hsl(185 100% 75%)" }}>{effectiveGreen(selectedLane)}s</span>
            </div>
            <input type="range" min={10} max={60} step={5}
              value={effectiveGreen(selectedLane)}
              onChange={e => setGreenTime(selectedLane, Number(e.target.value))}
              style={{ width: "100%", accentColor: "hsl(185 100% 55%)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "hsl(220 25% 56%)", marginTop: 4 }}>
              <span>10s (min)</span><span>60s (max)</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => clearOverride(selectedLane)} disabled={loading} style={{
              flex: 1, padding: "8px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              background: "rgba(2,8,26,0.70)", border: "1px solid hsl(220 40% 26%)", color: "hsl(185 80% 68%)",
              fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            }}>RESTORE AI CONTROL</button>
          </div>
        </div>
      </div>

      {/* All lanes overview */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>ALL LANES OVERVIEW</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {laneNames.map((name, i) => {
            const sig = effectiveSignal(i);
            return (
              <div key={i} style={{ background: "rgba(2,8,26,0.70)", border: `1px solid hsl(220 40% 22%)`, borderRadius: 6, padding: 10, textAlign: "center" as const }}>
                <div style={{ fontSize: 9, color: "hsl(185 80% 68%)", marginBottom: 6 }}>{name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: sig === "GREEN" ? "hsl(130 100% 60%)" : sig === "RED" ? "hsl(0 100% 68%)" : "hsl(45 100% 65%)" }}>
                  {sig}
                </div>
                {backendStatus?.green_lane === laneKeys[i] && (
                  <div style={{ fontSize: 8, color: "hsl(130 100% 60%)", marginTop: 2 }}>● GREEN NOW</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}