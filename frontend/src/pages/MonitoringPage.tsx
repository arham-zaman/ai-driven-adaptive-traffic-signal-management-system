import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { generateSnapshot, type TrafficSnapshot } from "../lib/trafficData";
import TrafficLight from "../components/TrafficLight";

export default function MonitoringPage() {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot>(generateSnapshot());
  const [history, setHistory] = useState<{ t: string; total: number }[]>([]);
  const [yoloDetections, setYoloDetections] = useState([
    { type: "Car", count: 456, confidence: 0.94 },
    { type: "Motorcycle", count: 123, confidence: 0.91 },
    { type: "Bus", count: 34, confidence: 0.97 },
    { type: "Truck", count: 28, confidence: 0.95 },
    { type: "Bicycle", count: 12, confidence: 0.88 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const snap = generateSnapshot();
      setSnapshot(snap);
      setHistory(prev => {
        const next = [...prev, { t: new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }), total: snap.totalVehicles }];
        return next.slice(-20);
      });
      setYoloDetections([
        { type: "Car", count: Math.floor(snap.totalVehicles * 0.58), confidence: 0.94 },
        { type: "Motorcycle", count: Math.floor(snap.totalVehicles * 0.16), confidence: 0.91 },
        { type: "Bus", count: Math.floor(snap.totalVehicles * 0.045), confidence: 0.97 },
        { type: "Truck", count: Math.floor(snap.totalVehicles * 0.036), confidence: 0.95 },
        { type: "Bicycle", count: Math.floor(snap.totalVehicles * 0.018), confidence: 0.88 },
      ]);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>LIVE MONITORING</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>Real-time AI vehicle detection · Adaptive Signal Management</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "hsl(130 100% 55%)", boxShadow: "0 0 10px hsl(130 100% 55%)" }} className="pulse-dot" />
          <span style={{ fontSize: 10, color: "hsl(130 100% 60%)", letterSpacing: "0.1em", fontWeight: 600 }}>LIVE FEED ACTIVE</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* AI detections */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(265 100% 74%)", marginBottom: 12 }}>
            AI DETECTION — LIVE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {yoloDetections.map(d => (
              <div key={d.type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 70, fontSize: 10, color: "hsl(185 80% 72%)", fontWeight: 600 }}>{d.type}</div>
                <div style={{ flex: 1, background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 8, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(d.count / Math.max(...yoloDetections.map(x => x.count))) * 100}%`,
                    background: "linear-gradient(90deg, hsl(265 100% 70%), hsl(185 100% 60%))",
                    boxShadow: "0 0 6px hsl(185 100% 60%)",
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <div style={{ width: 36, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "hsl(185 100% 75%)" }}>{d.count}</div>
                <div style={{ width: 40, fontSize: 9, color: "hsl(130 100% 60%)" }}>{(d.confidence * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live chart */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            REAL-TIME VEHICLE COUNT
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="glive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(185 100% 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(185 100% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
              <XAxis dataKey="t" tick={{ fill: "hsl(220 25% 62%)", fontSize: 8 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 11 }} />
              <Area type="monotone" dataKey="total" stroke="hsl(185 100% 60%)" strokeWidth={2} fill="url(#glive)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live signal grid */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 16 }}>
          LIVE SIGNAL STATUS — ALL LANES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {snapshot.lanes.map(lane => (
            <div key={lane.id} style={{
              background: "rgba(2,8,26,0.70)",
              border: `1px solid ${lane.signal === "GREEN" ? "hsl(120 100% 50% / 0.3)" : lane.signal === "RED" ? "hsl(0 100% 60% / 0.25)" : "hsl(50 100% 55% / 0.25)"}`,
              borderRadius: 8, padding: 12,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              <TrafficLight signal={lane.signal} label={lane.name} timeRemaining={lane.timeRemaining} small />
              <div style={{ width: "100%", fontSize: 9, color: "hsl(220 25% 56%)", textAlign: "center" }}>
                {lane.vehicleCount} vehicles · {lane.density}% density
              </div>
              <div style={{ width: "100%", background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${lane.density}%`,
                  background: lane.density > 70 ? "hsl(0 100% 68%)" : lane.density > 40 ? "hsl(45 100% 60%)" : "hsl(130 100% 55%)",
                  transition: "width 0.5s",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Prediction & Optimization outputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(50 100% 55% / 0.2)", borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(45 100% 65%)", marginBottom: 10 }}>AI PREDICTION OUTPUT</div>
          {snapshot.lanes.map(lane => (
            <div key={lane.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid hsl(220 40% 19%)" }}>
              <span style={{ fontSize: 10, color: "hsl(220 25% 66%)" }}>{lane.name}</span>
              <span style={{ fontSize: 10, color: "hsl(45 100% 65%)", fontFamily: "monospace" }}>
                +2h: {lane.vehicleCount + Math.floor(Math.random() * 50)} veh
              </span>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(120 100% 50% / 0.2)", borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(130 100% 60%)", marginBottom: 10 }}>AI SIGNAL TIMING OUTPUT</div>
          {snapshot.lanes.map(lane => (
            <div key={lane.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid hsl(220 40% 19%)" }}>
              <span style={{ fontSize: 10, color: "hsl(220 25% 66%)" }}>{lane.name}</span>
              <span style={{ fontSize: 10, color: "hsl(130 100% 60%)", fontFamily: "monospace" }}>
                Green: {lane.signal === "GREEN" ? lane.timeRemaining : Math.floor(Math.random() * 40 + 20)}s
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
