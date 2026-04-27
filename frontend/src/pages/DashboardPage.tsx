import React, { useState, useEffect } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from "recharts";
import { generateSnapshot, getPredictionData, type TrafficSnapshot } from "../lib/trafficData";

const SIGNAL_COLOR = {
  GREEN: "hsl(130 100% 55%)",
  YELLOW: "hsl(45 100% 60%)",
  RED: "hsl(0 100% 62%)",
};

/* ── Neon SVG car (front-facing, matches reference image style) ── */
function NeonCar({ color = "#00bfff", size = 38 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 2px ${color})` }}>
      {/* Body */}
      <path d="M6 28 C6 28 8 16 14 12 L20 8 L40 8 L46 12 C52 16 54 28 54 28 L54 34 C54 36 52 38 50 38 L10 38 C8 38 6 36 6 34 Z"
        stroke={color} strokeWidth="2" fill={`${color}18`} strokeLinejoin="round" />
      {/* Windshield */}
      <path d="M16 12 L20 8 L40 8 L44 12 L40 22 L20 22 Z"
        stroke={color} strokeWidth="1.5" fill={`${color}28`} strokeLinejoin="round" />
      {/* Roof cabin */}
      <path d="M20 8 L22 4 L38 4 L40 8"
        stroke={color} strokeWidth="1.5" fill={`${color}18`} strokeLinejoin="round" />
      {/* Left headlight */}
      <rect x="8" y="30" width="10" height="5" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}55`} />
      {/* Right headlight */}
      <rect x="42" y="30" width="10" height="5" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}55`} />
      {/* Left wheel arch */}
      <path d="M6 32 Q6 38 12 38" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Right wheel arch */}
      <path d="M54 32 Q54 38 48 38" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Center grill */}
      <rect x="24" y="30" width="12" height="4" rx="1" stroke={color} strokeWidth="1" fill={`${color}30`} />
      {/* Door lines */}
      <line x1="30" y1="22" x2="30" y2="36" stroke={color} strokeWidth="1" strokeDasharray="1 1" opacity="0.5" />
    </svg>
  );
}

/* ── shared panel style with traffic-bg behind a dark veil ── */
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
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "url('/traffic-bg.png')",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity,
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(135deg, rgba(6,14,34,0.72) 0%, rgba(3,10,28,0.80) 100%)",
      }} />
    </>
  );
}

/* ── mini traffic light ── */
function MiniTrafficLight({ signal }: { signal: "RED" | "YELLOW" | "GREEN" }) {
  const lights = ["RED", "YELLOW", "GREEN"] as const;
  return (
    <div style={{
      background: "#0a0a0a",
      borderRadius: 6,
      border: `2px solid ${SIGNAL_COLOR[signal]}`,
      boxShadow: `0 0 12px ${SIGNAL_COLOR[signal]}, 0 0 4px ${SIGNAL_COLOR[signal]}`,
      padding: "5px 4px",
      display: "flex", flexDirection: "column", gap: 3, alignItems: "center",
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

/* ── intersection signal status ── */
function IntersectionSignalStatus({ snapshot }: { snapshot: TrafficSnapshot }) {
  const [n, e, s, w] = snapshot.lanes;
  return (
    <div style={panelStyle({ height: "100%" })}>
      <PanelBg opacity={0.38} />
      <div style={{ position: "relative", zIndex: 2, padding: "14px 16px", height: "100%", boxSizing: "border-box" as const, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "hsl(185 100% 78%)", marginBottom: 10 }}>
          SIGNAL STATUS
        </div>

        {/* Intersection SVG */}
        <div style={{ position: "relative", flex: 1, minHeight: 200 }}>
          <svg width="100%" height="100%" viewBox="0 0 300 240" style={{ position: "absolute", inset: 0 }}>
            {/* Roads */}
            <rect x="112" y="0" width="76" height="240" fill="rgba(55,65,85,0.7)" />
            <rect x="0" y="82" width="300" height="76" fill="rgba(55,65,85,0.7)" />
            {/* Intersection center */}
            <rect x="112" y="82" width="76" height="76" fill="rgba(35,45,65,0.7)" />
            {/* Lane dashes - vertical */}
            {[5,32,170,195].map(y => <rect key={y} x="149" y={y} width="2" height="20" fill="rgba(255,255,255,0.45)" rx="1" />)}
            {/* Lane dashes - horizontal */}
            {[5,40,180,220].map(x => <rect key={x} x={x} y="119" width="20" height="2" fill="rgba(255,255,255,0.45)" rx="1" />)}
            {/* Zebra crossings top */}
            {[0,7,14,21,28,35,42,49].map(i => <rect key={`zt${i}`} x={117+i*7} y={67} width="5" height="13" fill="rgba(255,255,255,0.3)" rx="1" />)}
            {/* Zebra crossings bottom */}
            {[0,7,14,21,28,35,42,49].map(i => <rect key={`zb${i}`} x={117+i*7} y={160} width="5" height="13" fill="rgba(255,255,255,0.3)" rx="1" />)}
            {/* Zebra crossings left */}
            {[0,7,14,21,28,35,42,49].map(i => <rect key={`zl${i}`} x={96} y={87+i*7} width="13" height="5" fill="rgba(255,255,255,0.3)" rx="1" />)}
            {/* Zebra crossings right */}
            {[0,7,14,21,28,35,42,49].map(i => <rect key={`zr${i}`} x={191} y={87+i*7} width="13" height="5" fill="rgba(255,255,255,0.3)" rx="1" />)}
          </svg>

          {/* North */}
          <div style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600, whiteSpace: "nowrap" }}>{n.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[n.signal] }}>{n.signal} ({n.timeRemaining}s)</div>
            </div>
            <MiniTrafficLight signal={n.signal} />
          </div>

          {/* South */}
          <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column-reverse", alignItems: "center", gap: 3 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600, whiteSpace: "nowrap" }}>{s.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[s.signal] }}>{s.signal} ({s.timeRemaining}s)</div>
            </div>
            <MiniTrafficLight signal={s.signal} />
          </div>

          {/* West */}
          <div style={{ position: "absolute", top: "50%", left: 2, transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600, whiteSpace: "nowrap" }}>{w.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[w.signal] }}>{w.signal} ({w.timeRemaining}s)</div>
            </div>
            <MiniTrafficLight signal={w.signal} />
          </div>

          {/* East */}
          <div style={{ position: "absolute", top: "50%", right: 2, transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6, flexDirection: "row-reverse" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(200,230,255,0.8)", fontWeight: 600, whiteSpace: "nowrap" }}>{e.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: SIGNAL_COLOR[e.signal] }}>{e.signal} ({e.timeRemaining}s)</div>
            </div>
            <MiniTrafficLight signal={e.signal} />
          </div>
        </div>

        {/* Info strip */}
        <div style={{
          marginTop: 10,
          background: "rgba(0,20,50,0.65)",
          border: "1px solid rgba(0,160,220,0.2)",
          borderRadius: 6, padding: "8px 10px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {[
            { label: "CURRENT PLAN", value: snapshot.currentPlan, color: "hsl(185 100% 65%)" },
            { label: "ADAPTIVE MODE", value: "ACTIVE", color: "hsl(130 100% 60%)" },
            { label: "EST. NEXT PHASE", value: snapshot.nextPhase, color: "hsl(45 100% 60%)" },
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

/* ── 3-D blue metric card ── */
function MetricCard({ label, value, badge, accent }: {
  label: string; value: string | number; badge?: string; accent: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 150, perspective: "600px" }}>
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden",
        border: `1.5px solid ${accent}66`,
        boxShadow: `0 8px 32px ${accent}44, 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 ${accent}44`,
        transform: "rotateX(6deg) rotateY(-3deg) scale(1.01)",
        transformStyle: "preserve-3d" as const,
        transition: "transform 0.3s ease",
        background: `linear-gradient(145deg, ${accent}28 0%, rgba(4,14,42,0.88) 65%)`,
      }}
        onMouseEnter={e => (e.currentTarget.style.transform = "rotateX(0deg) rotateY(0deg) scale(1.04)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "rotateX(6deg) rotateY(-3deg) scale(1.01)")}
      >
        {/* Traffic bg — slightly more visible */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/traffic-bg.png')",
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.22,
        }} />
        {/* Blue gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(145deg, ${accent}20 0%, rgba(3,12,40,0.82) 70%)`,
        }} />
        {/* Top glow bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          boxShadow: `0 0 14px ${accent}`,
        }} />
        {/* Bottom shine */}
        <div style={{
          position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
        }} />

        <div style={{ position: "relative", zIndex: 2, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: `${accent}dd`, letterSpacing: "0.14em", fontWeight: 700 }}>{label}</div>
            {badge && (
              <div style={{
                fontSize: 8, padding: "2px 7px", borderRadius: 4, fontWeight: 800, letterSpacing: "0.1em",
                background: `${accent}30`, color: accent,
                border: `1px solid ${accent}66`,
                boxShadow: `0 0 8px ${accent}55`,
              }}>{badge}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <NeonCar color={accent} size={42} />
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 32, fontWeight: 700, color: "#fff",
              textShadow: `0 0 20px ${accent}, 0 0 8px ${accent}88`,
              letterSpacing: "0.04em",
            }}>{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── main page ── */
export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot>(generateSnapshot());
  const [predData] = useState(getPredictionData());

  useEffect(() => {
    const interval = setInterval(() => setSnapshot(generateSnapshot()), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>

      {/* ── Metric cards ── */}
      <div>
        <div style={{ fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.2em", marginBottom: 10, fontWeight: 600 }}>
          REAL-TIME TRAFFIC COUNTS
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <MetricCard label="TOTAL VEHICLES (LIVE)" value={snapshot.totalVehicles.toLocaleString()} badge="LIVE"    accent="#00bfff" />
          <MetricCard label="INBOUND FLOW"           value={snapshot.inboundFlow.toLocaleString()}   badge="INBOUND" accent="#3af5a8" />
          <MetricCard label="OUTBOUND FLOW"          value={snapshot.outboundFlow.toLocaleString()}  badge="OUT"     accent="#ff8c42" />
        </div>
      </div>

      {/* ── Chart + Signal Status ── */}
      <div style={{ display: "flex", gap: 14 }}>

        {/* Predicted Trends panel */}
        <div style={panelStyle({ flex: 1 })}>
          <PanelBg opacity={0.28} />
          <div style={{ position: "relative", zIndex: 2, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)", marginBottom: 14 }}>
              PREDICTED TRAFFIC TRENDS
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={predData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradPred" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00bfff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00bfff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradUpper" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00bfff" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#00bfff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,160,220,0.12)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(150,200,230,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(150,200,230,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(5,15,40,0.95)", border: "1px solid rgba(0,191,255,0.3)", borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: "#00bfff" }} itemStyle={{ color: "#7dd8ff" }}
                />
                <Area type="monotone" dataKey="upper"     stroke="#00bfff" strokeWidth={1} strokeDasharray="5 5" fill="url(#gradUpper)" name="Upper Bound" />
                <Area type="monotone" dataKey="predicted" stroke="#00bfff" strokeWidth={2}                       fill="url(#gradPred)"  name="Predicted" />
                <Area type="monotone" dataKey="lower"     stroke="#4a90d9" strokeWidth={1} strokeDasharray="3 3" fill="none"            name="Lower Bound" />
                <Legend wrapperStyle={{ fontSize: 10, color: "rgba(150,200,230,0.7)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Signal Status */}
        <div style={{ width: 330 }}>
          <IntersectionSignalStatus snapshot={snapshot} />
        </div>
      </div>

      {/* ── Lane density row ── */}
      <div style={{ display: "flex", gap: 10 }}>
        {snapshot.lanes.map(lane => {
          const sig = lane.signal;
          const c = sig === "GREEN" ? "#3af5a8" : sig === "RED" ? "#ff4040" : "#ffd040";
          return (
            <div key={lane.id} style={panelStyle({ flex: 1 })}>
              <PanelBg opacity={0.26} />
              <div style={{ position: "relative", zIndex: 2, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#7dd8ff", letterSpacing: "0.1em", marginBottom: 4 }}>{lane.name.toUpperCase()}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#fff" }}>{lane.vehicleCount}</span>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 700, color: c, background: `${c}22`, border: `1px solid ${c}55` }}>{sig}</span>
                </div>
                <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 3, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${lane.density}%`, background: c, boxShadow: `0 0 6px ${c}`, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: 9, color: "rgba(150,190,220,0.6)", marginTop: 3 }}>Density: {lane.density}% · Wait: {lane.waitTime}s</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── AI Decision ── */}
      <div style={panelStyle({ border: "1px solid rgba(180,100,255,0.25)" })}>
        <PanelBg opacity={0.26} />
        <div style={{ position: "relative", zIndex: 2, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18 }}>🧠</div>
          <div>
            <div style={{ fontSize: 9, color: "#b87fff", letterSpacing: "0.15em", fontWeight: 600 }}>AI DECISION</div>
            <div style={{ fontSize: 12, color: "#c8e8ff", marginTop: 2 }}>{snapshot.aiDecision}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3af5a8", boxShadow: "0 0 8px #3af5a8" }} className="pulse-dot" />
            <span style={{ fontSize: 9, color: "#3af5a8" }}>LIVE</span>
          </div>
        </div>
      </div>

    </div>
  );
}
