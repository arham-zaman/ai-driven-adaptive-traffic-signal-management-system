import React, { useState, useEffect, useRef } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, LineChart, Line } from "recharts";
import { generateSnapshot, type TrafficSnapshot } from "../lib/trafficData";
import { createWebSocket, signalsApi, predictionsApi, logsApi, LANE_DISPLAY, toSignalState, type WebSocketMessage } from "../lib/api";

const SIGNAL_COLOR = {
  GREEN:  "hsl(130 100% 55%)",
  YELLOW: "hsl(45 100% 60%)",
  RED:    "hsl(0 100% 62%)",
};

function NeonCar({ color = "#00bfff", size = 38 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 2px ${color})` }}>
      <path d="M6 28 C6 28 8 16 14 12 L20 8 L40 8 L46 12 C52 16 54 28 54 28 L54 34 C54 36 52 38 50 38 L10 38 C8 38 6 36 6 34 Z"
        stroke={color} strokeWidth="2" fill={`${color}18`} strokeLinejoin="round" />
      <path d="M16 12 L20 8 L40 8 L44 12 L40 22 L20 22 Z"
        stroke={color} strokeWidth="1.5" fill={`${color}28`} strokeLinejoin="round" />
      <rect x="8" y="30" width="10" height="5" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}55`} />
      <rect x="42" y="30" width="10" height="5" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}55`} />
    </svg>
  );
}

const panelStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  position: "relative",
  borderRadius: 10,
  overflow: "hidden",
  border: "1px solid rgba(0,160,220,0.25)",
  ...extra,
});

function PanelBg({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundSize: "cover", backgroundPosition: "center", opacity }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(135deg, rgba(6,14,34,0.72) 0%, rgba(3,10,28,0.80) 100%)" }} />
    </>
  );
}

function MiniTrafficLight({ signal }: { signal: "RED" | "YELLOW" | "GREEN" }) {
  const lights = ["RED", "YELLOW", "GREEN"] as const;
  return (
    <div style={{
      background: "#0a0a0a", borderRadius: 6,
      border: `2px solid ${SIGNAL_COLOR[signal]}`,
      boxShadow: `0 0 12px ${SIGNAL_COLOR[signal]}, 0 0 4px ${SIGNAL_COLOR[signal]}`,
      padding: "5px 4px", display: "flex", flexDirection: "column", gap: 3, alignItems: "center",
    }}>
      {lights.map(l => (
        <div key={l} style={{
          width: 11, height: 11, borderRadius: "50%",
          background: signal === l ? SIGNAL_COLOR[l] : "#222",
          boxShadow: signal === l ? `0 0 10px ${SIGNAL_COLOR[l]}, 0 0 4px ${SIGNAL_COLOR[l]}` : "none",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

function wsToLanes(wsData: WebSocketMessage, laneDisplay: Record<string, string>) {
  const laneKeys = ["north", "south", "east", "west"] as const;
  return laneKeys.map((key, i) => ({
    id:            `lane-${i}`,
    name:          laneDisplay[key],
    signal:        toSignalState(wsData.states[key]),
    timeRemaining: wsData.green_lane === key ? wsData.time_remaining : 0,
    vehicleCount:  0,
    density:       0,
    waitTime:      0,
  }));
}

function IntersectionSignalStatus({
  snapshot,
  wsData,
  isConnected,
}: {
  snapshot: TrafficSnapshot;
  wsData:   WebSocketMessage | null;
  isConnected: boolean;
}) {
  const lanes = wsData ? wsToLanes(wsData, LANE_DISPLAY) : snapshot.lanes;
  const [n, s, e, w] = [lanes[0], lanes[1], lanes[2], lanes[3]];
  const greenLane   = wsData?.green_lane ?? "";
  const currentPlan = wsData?.is_manual ? "MANUAL MODE" : "PLAN A (Adaptive AI)";

  return (
    <div style={panelStyle({ height: "100%" })}>
      <PanelBg opacity={0.38} />
      <div style={{ position: "relative", zIndex: 2, padding: "14px 16px", height: "100%", boxSizing: "border-box" as const, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "hsl(185 100% 78%)" }}>SIGNAL STATUS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isConnected ? "#3af5a8" : "#ff8c42",
              boxShadow: isConnected ? "0 0 8px #3af5a8" : "0 0 8px #ff8c42",
            }} className="pulse-dot" />
            <span style={{ fontSize: 9, color: isConnected ? "#3af5a8" : "#ff8c42" }}>
              {isConnected ? "LIVE BACKEND" : "DEMO"}
            </span>
          </div>
        </div>

        <div style={{ position: "relative", flex: 1, minHeight: 200 }}>
          <svg width="100%" height="100%" viewBox="0 0 300 240" style={{ position: "absolute", inset: 0 }}>
            <rect x="112" y="0" width="76" height="240" fill="rgba(55,65,85,0.7)" />
            <rect x="0" y="82" width="300" height="76" fill="rgba(55,65,85,0.7)" />
            <rect x="112" y="82" width="76" height="76" fill="rgba(35,45,65,0.7)" />
            {[5,32,170,195].map(y => <rect key={y} x="149" y={y} width="2" height="20" fill="rgba(255,255,255,0.45)" rx="1" />)}
            {[5,40,180,220].map(x => <rect key={x} x={x} y="119" width="20" height="2" fill="rgba(255,255,255,0.45)" rx="1" />)}
          </svg>

          {/* North */}
          <div style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600 }}>{n.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[n.signal] }}>
                {n.signal} {wsData?.green_lane === "north" ? `(${wsData.time_remaining}s)` : ""}
              </div>
            </div>
            <MiniTrafficLight signal={n.signal} />
          </div>

          {/* South */}
          <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column-reverse", alignItems: "center", gap: 3 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[s.signal] }}>
                {s.signal} {wsData?.green_lane === "south" ? `(${wsData.time_remaining}s)` : ""}
              </div>
            </div>
            <MiniTrafficLight signal={s.signal} />
          </div>

          {/* West */}
          <div style={{ position: "absolute", top: "50%", left: 2, transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600 }}>{w.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[w.signal] }}>
                {w.signal} {wsData?.green_lane === "west" ? `(${wsData.time_remaining}s)` : ""}
              </div>
            </div>
            <MiniTrafficLight signal={w.signal} />
          </div>

          {/* East */}
          <div style={{ position: "absolute", top: "50%", right: 2, transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6, flexDirection: "row-reverse" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600 }}>{e.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[e.signal] }}>
                {e.signal} {wsData?.green_lane === "east" ? `(${wsData.time_remaining}s)` : ""}
              </div>
            </div>
            <MiniTrafficLight signal={e.signal} />
          </div>
        </div>

        <div style={{ marginTop: 10, background: "rgba(0,20,50,0.65)", border: "1px solid rgba(0,160,220,0.2)", borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { label: "CURRENT PLAN", value: currentPlan,  color: "hsl(185 100% 65%)" },
            { label: "MODE",         value: wsData?.is_manual ? "MANUAL" : "AI ADAPTIVE", color: wsData?.is_manual ? "hsl(45 100% 60%)" : "hsl(130 100% 60%)" },
            { label: "GREEN LANE",   value: greenLane ? greenLane.toUpperCase() : "—", color: "hsl(130 100% 60%)" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "rgba(150,190,220,0.7)", letterSpacing: "0.1em" }}>{item.label}:</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Real stat card using backend data ─────────────────────────
function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string | number; sub: string; accent: string; icon: string;
}) {
  return (
    <div style={{ flex: 1, perspective: "600px" }}>
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden",
        border: `1.5px solid ${accent}66`,
        boxShadow: `0 8px 32px ${accent}44, 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 ${accent}44`,
        background: `linear-gradient(145deg, ${accent}28 0%, rgba(4,14,42,0.88) 65%)`,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 14px ${accent}` }} />
        <div style={{ position: "relative", zIndex: 2, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: `${accent}dd`, letterSpacing: "0.14em", fontWeight: 700 }}>{label}</div>
            <span style={{ fontSize: 20 }}>{icon}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <NeonCar color={accent} size={38} />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 30, fontWeight: 700, color: "#fff", textShadow: `0 0 20px ${accent}, 0 0 8px ${accent}88` }}>{value}</div>
          </div>
          <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", marginTop: 6 }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [snapshot, setSnapshot]       = useState<TrafficSnapshot>(generateSnapshot());
  const [wsData, setWsData]           = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Real backend stats
  const [totalPredictions, setTotalPredictions] = useState<number>(0);
  const [totalSignalCycles, setTotalSignalCycles] = useState<number>(0);
  const [manualOverrides, setManualOverrides]   = useState<number>(0);

  // Real prediction history for chart
  const [predHistory, setPredHistory] = useState<{ t: string; north: number; south: number; east: number; west: number }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  // ── WebSocket ──────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      try {
        const ws = (window as any).__createWebSocket
          ? (window as any).__createWebSocket(setWsData, () => { setIsConnected(false); setTimeout(connect, 3000); })
          : (() => {
              // Inline implementation
              const ws = new WebSocket("ws://localhost:8000/ws");
              ws.onmessage = (event) => {
                try { setWsData(JSON.parse(event.data)); setIsConnected(true); } catch {}
              };
              ws.onerror = () => { setIsConnected(false); };
              ws.onclose = () => { setIsConnected(false); setTimeout(connect, 3000); };
              return ws;
            })();
        wsRef.current = ws;
      } catch { setTimeout(connect, 3000); }
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  // ── Fetch real backend summary stats ──────────────────────
  const fetchStats = () => {
    fetch("http://localhost:8000/logs/summary")
      .then(r => r.json())
      .then(data => {
        setTotalPredictions(data.total_predictions ?? 0);
        setManualOverrides(data.manual_overrides ?? 0);
      }).catch(() => {});

    fetch("http://localhost:8000/signals/stats")
      .then(r => r.json())
      .then(data => {
        const total = Object.values(data as Record<string, any>)
          .reduce((sum: number, v: any) => sum + (v.total_cycles ?? 0), 0);
        setTotalSignalCycles(total);
      }).catch(() => {});
  };

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 5000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch real prediction history for chart ──────────────
  const fetchPredHistory = () => {
    fetch("http://localhost:8000/predictions/?limit=40")
      .then(r => r.json())
      .then((data: any[]) => {
        if (!data || data.length === 0) return;

        // Group by time bucket (last 20 data points, per lane)
        const laneKeys = ["north", "south", "east", "west"];
        const byTime: Record<string, Record<string, number[]>> = {};

        data.forEach((p: any) => {
          const t = new Date(p.timestamp).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit" });
          if (!byTime[t]) byTime[t] = {};
          if (!byTime[t][p.lane]) byTime[t][p.lane] = [];
          byTime[t][p.lane].push(p.predicted_green_time);
        });

        const chartData = Object.entries(byTime).slice(-20).map(([t, lanes]) => ({
          t,
          north: Math.round((lanes["north"] || [30]).reduce((a: number, b: number) => a + b, 0) / (lanes["north"]?.length || 1)),
          south: Math.round((lanes["south"] || [30]).reduce((a: number, b: number) => a + b, 0) / (lanes["south"]?.length || 1)),
          east:  Math.round((lanes["east"]  || [30]).reduce((a: number, b: number) => a + b, 0) / (lanes["east"]?.length  || 1)),
          west:  Math.round((lanes["west"]  || [30]).reduce((a: number, b: number) => a + b, 0) / (lanes["west"]?.length  || 1)),
        }));

        if (chartData.length > 0) setPredHistory(chartData);
      }).catch(() => {});
  };

  useEffect(() => {
    fetchPredHistory();
    const t = setInterval(fetchPredHistory, 5000);
    return () => clearInterval(t);
  }, []);

  // ── Fallback mock when disconnected ───────────────────────
  useEffect(() => {
    if (isConnected) return;
    const t = setInterval(() => setSnapshot(generateSnapshot()), 2000);
    return () => clearInterval(t);
  }, [isConnected]);

  // ── Display lanes ─────────────────────────────────────────
  const displayLanes = wsData
    ? snapshot.lanes.map((lane, i) => {
        const key = ["north", "south", "east", "west"][i];
        return {
          ...lane,
          signal: toSignalState((wsData.states as Record<string, string>)[key]),
          timeRemaining: wsData.green_lane === key ? wsData.time_remaining : lane.timeRemaining,
        };
      })
    : snapshot.lanes;

  const aiDecision = wsData?.is_manual
    ? "Manual override active — AI control suspended"
    : isConnected
    ? "AI adaptive mode active — analyzing live traffic patterns"
    : "Demo mode — start demo_runner.py for live data";

  // Chart: use real data if available, else show empty state message
  const hasRealPredHistory = predHistory.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>

      {/* ── Real Backend Stat Cards ── */}
      <div>
        <div style={{ fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.2em", marginBottom: 10, fontWeight: 600 }}>
          SYSTEM STATISTICS {isConnected ? "· LIVE" : "· " + (totalPredictions > 0 ? "FROM DB" : "WAITING FOR BACKEND")}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <StatCard
            label="PREDICTIONS MADE"
            value={totalPredictions.toLocaleString()}
            sub="Total AI green time predictions"
            accent="#00bfff"
            icon="🧠"
          />
          <StatCard
            label="SIGNAL CYCLES"
            value={totalSignalCycles.toLocaleString()}
            sub="Total adaptive signal phase changes"
            accent="#3af5a8"
            icon="🚦"
          />
          <StatCard
            label="MANUAL OVERRIDES"
            value={manualOverrides.toLocaleString()}
            sub="Human interventions recorded"
            accent="#ff8c42"
            icon="🖱️"
          />
        </div>
      </div>

      {/* ── Chart + Signal Status ── */}
      <div style={{ display: "flex", gap: 14 }}>
        <div style={panelStyle({ flex: 1 })}>
          <PanelBg opacity={0.28} />
          <div style={{ position: "relative", zIndex: 2, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>
                PREDICTED GREEN TIME — REAL-TIME HISTORY
              </div>
              <span style={{ fontSize: 9, color: hasRealPredHistory ? "hsl(130 100% 60%)" : "hsl(45 100% 65%)", padding: "2px 8px", borderRadius: 4, border: `1px solid ${hasRealPredHistory ? "hsl(130 100% 50%/0.4)" : "hsl(45 100% 50%/0.4)"}` }}>
                {hasRealPredHistory ? "REAL DATA" : "WAITING FOR PREDICTIONS"}
              </span>
            </div>

            {!hasRealPredHistory ? (
              <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ fontSize: 28 }}>📊</div>
                <div style={{ fontSize: 12, color: "hsl(185 100% 65%)" }}>No prediction data yet</div>
                <div style={{ fontSize: 10, color: "hsl(220 25% 56%)", textAlign: "center" as const }}>
                  Run <code style={{ background: "rgba(0,180,255,0.1)", padding: "2px 6px", borderRadius: 3, color: "hsl(185 100% 75%)" }}>python demo_runner.py</code> to start live predictions
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={predHistory} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,160,220,0.12)" />
                  <XAxis dataKey="t" tick={{ fill: "rgba(150,200,230,0.6)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[10, 60]} tick={{ fill: "rgba(150,200,230,0.6)", fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: "Green Time (s)", angle: -90, position: "insideLeft", fill: "rgba(150,200,230,0.5)", fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: "rgba(5,15,40,0.95)", border: "1px solid rgba(0,191,255,0.3)", borderRadius: 6, fontSize: 11 }} formatter={(v: number) => [`${v}s`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "rgba(150,200,230,0.7)" }} />
                  <Line type="monotone" dataKey="north" stroke="hsl(185 100% 60%)" strokeWidth={2} dot={false} name="North" />
                  <Line type="monotone" dataKey="south" stroke="hsl(265 100% 70%)" strokeWidth={2} dot={false} name="South" />
                  <Line type="monotone" dataKey="east"  stroke="hsl(45 100% 60%)"  strokeWidth={2} dot={false} name="East" />
                  <Line type="monotone" dataKey="west"  stroke="hsl(0 100% 68%)"   strokeWidth={2} dot={false} name="West" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{ width: 330 }}>
          <IntersectionSignalStatus snapshot={snapshot} wsData={wsData} isConnected={isConnected} />
        </div>
      </div>

      {/* ── Lane Status Cards ── */}
      <div style={{ display: "flex", gap: 10 }}>
        {displayLanes.map(lane => {
          const sig = lane.signal;
          const c   = sig === "GREEN" ? "#3af5a8" : sig === "RED" ? "#ff4040" : "#ffd040";
          return (
            <div key={lane.id} style={panelStyle({ flex: 1 })}>
              <PanelBg opacity={0.26} />
              <div style={{ position: "relative", zIndex: 2, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#7dd8ff", letterSpacing: "0.1em", marginBottom: 4 }}>{lane.name.toUpperCase()}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    {lane.vehicleCount > 0 ? lane.vehicleCount : "—"}
                  </span>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 700, color: c, background: `${c}22`, border: `1px solid ${c}55` }}>{sig}</span>
                </div>
                {lane.timeRemaining > 0 && (
                  <div style={{ fontSize: 10, color: c, fontFamily: "monospace", marginBottom: 4 }}>
                    ⏱ {lane.timeRemaining}s remaining
                  </div>
                )}
                <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 3, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, lane.density)}%`, background: c, boxShadow: `0 0 6px ${c}`, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: 9, color: "rgba(150,190,220,0.6)", marginTop: 3 }}>
                  {lane.density > 0 ? `Density: ${lane.density}%` : "Waiting for video data..."}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── AI Decision Banner ── */}
      <div style={panelStyle({ border: "1px solid rgba(180,100,255,0.25)" })}>
        <PanelBg opacity={0.26} />
        <div style={{ position: "relative", zIndex: 2, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18 }}>🧠</div>
          <div>
            <div style={{ fontSize: 9, color: "#b87fff", letterSpacing: "0.15em", fontWeight: 600 }}>AI DECISION ENGINE</div>
            <div style={{ fontSize: 12, color: "#c8e8ff", marginTop: 2 }}>{aiDecision}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: isConnected ? "#3af5a8" : "#ff8c42", boxShadow: isConnected ? "0 0 8px #3af5a8" : "0 0 8px #ff8c42" }} className="pulse-dot" />
            <span style={{ fontSize: 9, color: isConnected ? "#3af5a8" : "#ff8c42" }}>
              {isConnected ? "LIVE" : "DEMO MODE"}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}