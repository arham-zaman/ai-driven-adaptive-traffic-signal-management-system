import React, { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { generateSnapshot, type TrafficSnapshot } from "../lib/trafficData";
import TrafficLight from "../components/TrafficLight";
import { createWebSocket, predictionsApi, signalsApi, LANE_DISPLAY, LANE_KEYS, toSignalState, type WebSocketMessage } from "../lib/api";

export default function MonitoringPage() {
  const [snapshot, setSnapshot]         = useState<TrafficSnapshot>(generateSnapshot());
  const [history, setHistory]           = useState<{ t: string; total: number }[]>([]);
  const [wsData, setWsData]             = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected]   = useState(false);
  const [predStats, setPredStats]       = useState<Record<string, any>>({});
  const [signalStats, setSignalStats]   = useState<Record<string, any>>({});

  // Real traffic logs from backend (populated by demo_runner.py)
  const [trafficLogs, setTrafficLogs]   = useState<any[]>([]);
  const wsRef                           = useRef<WebSocket | null>(null);

  // ── WebSocket ──────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket("ws://localhost:8000/ws");
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setWsData(data);
            setIsConnected(true);
            setHistory(prev => {
              const t = new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
              return [...prev, { t, total: 0 }].slice(-30);
            });
          } catch {}
        };
        ws.onerror = () => { setIsConnected(false); };
        ws.onclose = () => { setIsConnected(false); setTimeout(connect, 3000); };
        wsRef.current = ws;
      } catch { setTimeout(connect, 3000); }
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  // ── Fetch traffic logs (real from demo_runner) ─────────────
  const fetchLogs = () => {
    fetch("http://localhost:8000/logs/?limit=20")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setTrafficLogs(data);
      }).catch(() => {});
  };

  // ── Fetch prediction & signal stats ───────────────────────
  useEffect(() => {
    fetchLogs();
    predictionsApi.getStats().then(setPredStats).catch(() => {});
    signalsApi.getStats().then(setSignalStats).catch(() => {});

    const t = setInterval(() => {
      fetchLogs();
      predictionsApi.getStats().then(setPredStats).catch(() => {});
      signalsApi.getStats().then(setSignalStats).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // ── Compute live vehicle counts from real logs ─────────────
  // Take the most recent log per lane
  const latestByLane: Record<string, any> = {};
  trafficLogs.forEach(log => {
    if (!latestByLane[log.lane] ||
        new Date(log.timestamp) > new Date(latestByLane[log.lane].timestamp)) {
      latestByLane[log.lane] = log;
    }
  });

  const totalVehicles = Object.values(latestByLane)
    .reduce((sum: number, v: any) => sum + (v.vehicle_count || 0), 0);

  // Update history with real vehicle counts
  useEffect(() => {
    if (totalVehicles > 0) {
      setHistory(prev => {
        const t = new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return [...prev.filter(p => p.t !== t), { t, total: totalVehicles }].slice(-30);
      });
    }
  }, [totalVehicles]);

  // ── Mock snapshot update for signal display ────────────────
  useEffect(() => {
    const t = setInterval(() => setSnapshot(generateSnapshot()), 2000);
    return () => clearInterval(t);
  }, []);

  // ── Build real YOLO-style detection summary from logs ──────
  // Categories from logs (vehicle_count per lane)
  const detectionSummary = LANE_KEYS.map((lane, i) => {
    const log = latestByLane[lane];
    const count = log?.vehicle_count ?? 0;
    const density = log?.density ?? 0;
    const queue = log?.queue_length ?? 0;
    const cat = count <= 5 ? "LOW" : count <= 15 ? "MEDIUM" : "HIGH";
    const colors = ["hsl(185 100% 60%)", "hsl(265 100% 70%)", "hsl(45 100% 60%)", "hsl(0 100% 68%)"];
    return { lane: LANE_DISPLAY[lane], count, density, queue, cat, color: colors[i] };
  });

  const hasRealData = trafficLogs.length > 0;

  // ── Build display lanes ────────────────────────────────────
  const displayLanes = snapshot.lanes.map((lane, i) => {
    const key = LANE_KEYS[i];
    const log = latestByLane[key];
    if (wsData?.states) {
      return {
        ...lane,
        name:          LANE_DISPLAY[key],
        signal:        toSignalState((wsData.states as any)[key]),
        timeRemaining: wsData.green_lane === key ? wsData.time_remaining : lane.timeRemaining,
        vehicleCount:  log?.vehicle_count ?? lane.vehicleCount,
        density:       log ? Math.min(100, Math.round((log.density ?? 0) * 100)) : lane.density,
      };
    }
    return {
      ...lane,
      name: LANE_DISPLAY[key],
      vehicleCount: log?.vehicle_count ?? lane.vehicleCount,
      density: log ? Math.min(100, Math.round((log.density ?? 0) * 100)) : lane.density,
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>LIVE MONITORING</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>
            Real-time data from demo_runner.py · YOLOv8 Vehicle Detection
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
            background: isConnected ? "hsl(130 100% 55%)" : hasRealData ? "hsl(45 100% 60%)" : "hsl(0 100% 62%)",
            boxShadow: isConnected ? "0 0 10px hsl(130 100% 55%)" : "0 0 8px hsl(45 100% 60%)"
          }} className="pulse-dot" />
          <span style={{ fontSize: 10, letterSpacing: "0.1em", fontWeight: 600,
            color: isConnected ? "hsl(130 100% 60%)" : hasRealData ? "hsl(45 100% 65%)" : "hsl(220 25% 56%)"
          }}>
            {isConnected ? "BACKEND LIVE" : hasRealData ? "DATA FROM DB" : "WAITING — run demo_runner.py"}
          </span>
        </div>
      </div>

      {/* ── Demo instruction banner (shown when no real data) ── */}
      {!hasRealData && (
        <div style={{ padding: "12px 16px", background: "rgba(45, 100, 255, 0.08)", border: "1px solid rgba(45, 100, 255, 0.3)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22 }}>🚦</div>
          <div>
            <div style={{ fontSize: 11, color: "hsl(185 100% 75%)", fontWeight: 700 }}>Start Demo to See Live Data</div>
            <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>
              Run: <code style={{ background: "rgba(0,180,255,0.12)", padding: "2px 8px", borderRadius: 3, color: "hsl(185 100% 75%)", fontFamily: "monospace" }}>python demo_runner.py</code>
              &nbsp; then watch this page update in real-time
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Real vehicle detection per lane */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(265 100% 74%)", marginBottom: 12 }}>
            {hasRealData ? "YOLO DETECTION — REAL-TIME PER LANE" : "YOLO DETECTION — WAITING FOR DATA"}
          </div>
          {hasRealData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {detectionSummary.map(d => {
                const catColor = d.cat === "LOW" ? "#3af5a8" : d.cat === "MEDIUM" ? "#ffd040" : "#ff4040";
                return (
                  <div key={d.lane}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ width: 100, fontSize: 10, color: "hsl(185 80% 72%)", fontWeight: 600 }}>{d.lane}</div>
                      <div style={{ flex: 1, background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 8, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.min(100, (d.count / 20) * 100)}%`,
                          background: d.color,
                          boxShadow: `0 0 6px ${d.color}`,
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                      <div style={{ width: 28, textAlign: "right" as const, fontFamily: "monospace", fontSize: 13, color: "hsl(185 100% 75%)" }}>{d.count}</div>
                      <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, fontWeight: 700, color: catColor, background: `${catColor}22`, border: `1px solid ${catColor}44`, width: 46, textAlign: "center" as const }}>{d.cat}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "hsl(220 25% 50%)", paddingLeft: 110 }}>
                      Queue: {d.queue} · Density: {(d.density * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 4, padding: "6px 10px", background: "rgba(0,180,255,0.06)", borderRadius: 5, border: "1px solid rgba(0,180,255,0.15)" }}>
                <div style={{ fontSize: 9, color: "hsl(185 100% 65%)", fontWeight: 700 }}>
                  TOTAL VEHICLES (ALL LANES): {totalVehicles}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LANE_KEYS.map((lane, i) => (
                <div key={lane} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 100, fontSize: 10, color: "hsl(220 25% 50%)" }}>{LANE_DISPLAY[lane]}</div>
                  <div style={{ flex: 1, background: "rgba(2,6,20,0.50)", borderRadius: 3, height: 8 }} />
                  <div style={{ fontSize: 9, color: "hsl(220 25% 40%)" }}>—</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live vehicle count chart */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            TOTAL VEHICLE COUNT — LIVE
          </div>
          {history.length < 3 ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 20 }}>📈</div>
              <div style={{ fontSize: 10, color: "hsl(220 25% 56%)" }}>Chart will populate when demo runs</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="glive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(185 100% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(185 100% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
                <XAxis dataKey="t" tick={{ fill: "hsl(220 25% 62%)", fontSize: 8 }} axisLine={false} tickLine={false} interval={5} />
                <YAxis tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 11 }} />
                <Area type="monotone" dataKey="total" stroke="hsl(185 100% 60%)" strokeWidth={2} fill="url(#glive)" name="Total Vehicles" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Live signal grid */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 16 }}>
          LIVE SIGNAL STATUS — ALL LANES
          {isConnected && <span style={{ marginLeft: 8, fontSize: 9, color: "hsl(130 100% 60%)" }}>● BACKEND LIVE</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {displayLanes.map(lane => (
            <div key={lane.id} style={{
              background: "rgba(2,8,26,0.70)",
              border: `1px solid ${lane.signal === "GREEN" ? "hsl(120 100% 50% / 0.3)" : lane.signal === "RED" ? "hsl(0 100% 60% / 0.25)" : "hsl(50 100% 55% / 0.25)"}`,
              borderRadius: 8, padding: 12,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              <TrafficLight signal={lane.signal} label={lane.name} timeRemaining={lane.timeRemaining} small />
              <div style={{ width: "100%", fontSize: 9, color: "hsl(220 25% 56%)", textAlign: "center" as const }}>
                {lane.vehicleCount > 0 ? `${lane.vehicleCount} vehicles` : "—"} · {lane.density}% density
              </div>
              <div style={{ width: "100%", background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${lane.density}%`,
                  background: lane.density > 70 ? "hsl(0 100% 68%)" : lane.density > 40 ? "hsl(45 100% 60%)" : "hsl(130 100% 55%)",
                  transition: "width 0.5s"
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Prediction & Signal Stats from backend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(50 100% 55% / 0.2)", borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(45 100% 65%)", marginBottom: 10 }}>
            AI PREDICTION STATS (LIVE)
          </div>
          {LANE_KEYS.map(lane => {
            const stats = predStats[lane];
            return (
              <div key={lane} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid hsl(220 40% 19%)" }}>
                <span style={{ fontSize: 10, color: "hsl(220 25% 66%)" }}>{LANE_DISPLAY[lane]}</span>
                <span style={{ fontSize: 10, color: "hsl(45 100% 65%)", fontFamily: "monospace" }}>
                  {stats ? `Avg: ${stats.avg}s · ${stats.count} preds` : "No predictions yet"}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(120 100% 50% / 0.2)", borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(130 100% 60%)", marginBottom: 10 }}>
            SIGNAL CYCLE STATS (LIVE)
          </div>
          {LANE_KEYS.map(lane => {
            const stats = signalStats[lane];
            return (
              <div key={lane} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid hsl(220 40% 19%)" }}>
                <span style={{ fontSize: 10, color: "hsl(220 25% 66%)" }}>{LANE_DISPLAY[lane]}</span>
                <span style={{ fontSize: 10, color: "hsl(130 100% 60%)", fontFamily: "monospace" }}>
                  {stats ? `${stats.total_cycles} cycles · ${stats.avg_green_time}s avg` : "No data yet"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}