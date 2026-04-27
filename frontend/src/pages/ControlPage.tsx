import React, { useState } from "react";
import { generateSnapshot, type SignalState } from "../lib/trafficData";
import TrafficLight from "../components/TrafficLight";

type LaneOverride = { signal: SignalState; greenTime: number };

const laneNames = ["Main St North", "Broadway East", "Main St South", "Broadway West"];

export default function ControlPage() {
  const [snapshot] = useState(generateSnapshot());
  const [overrides, setOverrides] = useState<Record<string, LaneOverride>>({});
  const [selectedLane, setSelectedLane] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const effectiveSignal = (i: number): SignalState => overrides[`lane-${i}`]?.signal ?? snapshot.lanes[i].signal;
  const effectiveGreen = (i: number): number => overrides[`lane-${i}`]?.greenTime ?? snapshot.lanes[i].timeRemaining;

  const setSignal = (laneIdx: number, signal: SignalState) => {
    setOverrides(prev => ({
      ...prev,
      [`lane-${laneIdx}`]: { ...prev[`lane-${laneIdx}`], signal, greenTime: prev[`lane-${laneIdx}`]?.greenTime ?? 30 },
    }));
    setLastAction(`Set ${laneNames[laneIdx]} to ${signal}`);
  };

  const setGreenTime = (laneIdx: number, t: number) => {
    setOverrides(prev => ({
      ...prev,
      [`lane-${laneIdx}`]: { ...prev[`lane-${laneIdx}`], greenTime: t, signal: prev[`lane-${laneIdx}`]?.signal ?? "GREEN" },
    }));
    setLastAction(`Adjusted green time for ${laneNames[laneIdx]} to ${t}s`);
  };

  const clearOverride = (laneIdx: number) => {
    const next = { ...overrides };
    delete next[`lane-${laneIdx}`];
    setOverrides(next);
    setLastAction(`Restored AI control for ${laneNames[laneIdx]}`);
  };

  const clearAll = () => {
    setOverrides({});
    setLastAction("All overrides cleared — AI control restored");
  };

  const overrideCount = Object.keys(overrides).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>CONTROL PANEL</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>Manual override · AI decision override</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {overrideCount > 0 && (
            <div style={{ padding: "3px 10px", background: "hsl(50 100% 55% / 0.15)", border: "1px solid hsl(50 100% 55% / 0.4)", borderRadius: 4, fontSize: 9, color: "hsl(45 100% 65%)", fontWeight: 700 }}>
              {overrideCount} MANUAL OVERRIDE{overrideCount > 1 ? "S" : ""} ACTIVE
            </div>
          )}
          <button onClick={clearAll} style={{
            padding: "5px 12px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            background: "hsl(0 100% 60% / 0.1)", border: "1px solid hsl(0 100% 60% / 0.3)", color: "hsl(0 100% 68%)", letterSpacing: "0.1em",
          }}>RESTORE ALL AI</button>
        </div>
      </div>

      {/* Mode status */}
      <div style={{
        background: overrideCount > 0 ? "hsl(50 100% 55% / 0.08)" : "hsl(120 100% 50% / 0.08)",
        border: `1px solid ${overrideCount > 0 ? "hsl(50 100% 55% / 0.3)" : "hsl(120 100% 50% / 0.3)"}`,
        borderRadius: 8, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ fontSize: 20 }}>{overrideCount > 0 ? "⚠️" : "🤖"}</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: overrideCount > 0 ? "hsl(45 100% 65%)" : "hsl(130 100% 60%)", letterSpacing: "0.1em" }}>
            {overrideCount > 0 ? `MANUAL MODE — ${overrideCount} LANE(S) OVERRIDDEN` : "AUTONOMOUS AI MODE — ALL LANES"}
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
            fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textAlign: "center",
          }}>
            {name}
            {overrides[`lane-${i}`] && <div style={{ fontSize: 8, color: "hsl(45 100% 65%)", marginTop: 2 }}>OVERRIDE</div>}
          </button>
        ))}
      </div>

      {/* Main control for selected lane */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        <div style={{
          background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 20,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 10, color: "hsl(185 80% 68%)", letterSpacing: "0.1em", fontWeight: 600 }}>CURRENT STATE</div>
          <TrafficLight
            signal={effectiveSignal(selectedLane)}
            label={laneNames[selectedLane]}
            timeRemaining={effectiveGreen(selectedLane)}
          />
          {overrides[`lane-${selectedLane}`] && (
            <div style={{ fontSize: 9, color: "hsl(45 100% 65%)", background: "hsl(50 100% 55% / 0.1)", padding: "3px 8px", borderRadius: 3, border: "1px solid hsl(50 100% 55% / 0.3)" }}>
              MANUAL OVERRIDE ACTIVE
            </div>
          )}
        </div>

        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 16 }}>
            CONTROL — {laneNames[selectedLane].toUpperCase()}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>SET SIGNAL STATE</div>
            <div style={{ display: "flex", gap: 10 }}>
              {(["GREEN", "YELLOW", "RED"] as SignalState[]).map(sig => (
                <button key={sig} onClick={() => setSignal(selectedLane, sig)} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                  background: effectiveSignal(selectedLane) === sig
                    ? sig === "GREEN" ? "hsl(120 100% 50% / 0.2)" : sig === "RED" ? "hsl(0 100% 60% / 0.2)" : "hsl(50 100% 55% / 0.2)"
                    : "hsl(222 38% 10%)",
                  border: `1px solid ${effectiveSignal(selectedLane) === sig
                    ? sig === "GREEN" ? "hsl(120 100% 50% / 0.6)" : sig === "RED" ? "hsl(0 100% 60% / 0.6)" : "hsl(50 100% 55% / 0.6)"
                    : "hsl(220 40% 24%)"}`,
                  color: sig === "GREEN" ? "hsl(130 100% 60%)" : sig === "RED" ? "hsl(0 100% 68%)" : "hsl(45 100% 65%)",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                  boxShadow: effectiveSignal(selectedLane) === sig
                    ? sig === "GREEN" ? "0 0 15px hsl(120 100% 50% / 0.3)" : sig === "RED" ? "0 0 15px hsl(0 100% 60% / 0.3)" : "0 0 15px hsl(50 100% 55% / 0.3)"
                    : "none",
                }}>{sig}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.1em", fontWeight: 600 }}>ADJUST GREEN TIME</div>
              <span style={{ fontFamily: "monospace", fontSize: 16, color: "hsl(185 100% 75%)" }}>{effectiveGreen(selectedLane)}s</span>
            </div>
            <input
              type="range" min={5} max={120} step={5}
              value={effectiveGreen(selectedLane)}
              onChange={e => setGreenTime(selectedLane, Number(e.target.value))}
              style={{ width: "100%", accentColor: "hsl(185 100% 55%)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "hsl(220 25% 56%)", marginTop: 4 }}>
              <span>5s (min)</span><span>120s (max)</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => clearOverride(selectedLane)} style={{
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
          {laneNames.map((name, i) => (
            <div key={i} style={{
              background: "rgba(2,8,26,0.70)",
              border: `1px solid ${overrides[`lane-${i}`] ? "hsl(50 100% 55% / 0.3)" : "hsl(220 40% 22%)"}`,
              borderRadius: 6, padding: 10, textAlign: "center",
            }}>
              <div style={{ fontSize: 9, color: "hsl(185 80% 68%)", marginBottom: 6, letterSpacing: "0.05em" }}>{name}</div>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: effectiveSignal(i) === "GREEN" ? "hsl(130 100% 60%)" : effectiveSignal(i) === "RED" ? "hsl(0 100% 68%)" : "hsl(45 100% 65%)",
                textShadow: effectiveSignal(i) === "GREEN" ? "0 0 8px hsl(130 100% 60%)" : effectiveSignal(i) === "RED" ? "0 0 8px hsl(0 100% 68%)" : "0 0 8px hsl(45 100% 60%)",
              }}>{effectiveSignal(i)} ({effectiveGreen(i)}s)</div>
              {overrides[`lane-${i}`] && (
                <div style={{ fontSize: 8, color: "hsl(45 100% 65%)", marginTop: 4, fontWeight: 700 }}>MANUAL</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
