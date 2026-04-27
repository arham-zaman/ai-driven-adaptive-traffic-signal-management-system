import React from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell
} from "recharts";
import { getAIMetrics } from "../lib/trafficData";

const tooltipStyle = {
  contentStyle: { background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 11 },
  labelStyle: { color: "hsl(185 100% 75%)" },
};

export default function AIAnalyticsPage() {
  const metrics = getAIMetrics();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(270 100% 75%)" }}>AI ANALYTICS</div>
        <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>AI model performance metrics · Adaptive Signal Management</div>
      </div>

      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "MODEL ACCURACY", value: `${metrics.accuracy}%`, color: "hsl(130 100% 60%)", sub: "Overall prediction" },
          { label: "TOTAL OPTIMIZATIONS", value: metrics.totalOptimizations.toLocaleString(), color: "hsl(185 100% 70%)", sub: "Since deployment" },
          { label: "CONGESTION REDUCED", value: `${metrics.congestionReduced}%`, color: "hsl(265 100% 74%)", sub: "vs baseline" },
          { label: "AVG WAIT REDUCTION", value: `${metrics.avgWaitReduction}%`, color: "hsl(45 100% 65%)", sub: "Per vehicle" },
        ].map(m => (
          <div key={m.label} style={{
            background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: "12px 14px",
            position: "relative" as const, overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${m.color}, transparent)` }} />
            <div style={{ fontSize: 9, color: "hsl(185 80% 64%)", letterSpacing: "0.12em", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: m.color, fontFamily: "monospace", textShadow: `0 0 15px ${m.color}66` }}>{m.value}</div>
            <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Model status */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { name: "Detection AI",   task: "Vehicle Detection",    status: "ACTIVE", color: "hsl(130 100% 60%)", acc: "94.7%", detail: "30fps · 4 cameras" },
          { name: "Prediction AI",  task: "Traffic Forecasting",  status: "ACTIVE", color: "hsl(185 100% 65%)", acc: "91.2%", detail: "2h horizon" },
          { name: "Optimizer AI",   task: "Signal Optimization",  status: "ACTIVE", color: "hsl(265 100% 74%)", acc: "93.8%", detail: "4-lane graph" },
        ].map(model => (
          <div key={model.name} style={{
            flex: 1, background: "rgba(3,12,38,0.62)", border: `1px solid ${model.color}30`, borderRadius: 8, padding: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: model.color, letterSpacing: "0.05em" }}>{model.name}</div>
                <div style={{ fontSize: 9, color: "hsl(220 25% 62%)" }}>{model.task}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: model.color, boxShadow: `0 0 8px ${model.color}` }} className="pulse-dot" />
                <span style={{ fontSize: 9, fontWeight: 700, color: model.color }}>ACTIVE</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 9, color: "hsl(220 25% 56%)" }}>Accuracy</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(185 100% 75%)", fontFamily: "monospace" }}>{model.acc}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "hsl(220 25% 56%)" }}>Config</div>
                <div style={{ fontSize: 11, color: "hsl(185 80% 68%)", marginTop: 2 }}>{model.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Feature importance */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            AI FEATURE IMPORTANCE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {metrics.featureImportance.map((f, i) => (
              <div key={f.feature}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "hsl(185 80% 72%)" }}>{f.feature}</span>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "hsl(185 100% 75%)" }}>{(f.importance * 100).toFixed(0)}%</span>
                </div>
                <div style={{ background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 6, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${f.importance * 100}%`,
                    background: `hsl(${195 + i * 15} 100% 55%)`,
                    boxShadow: `0 0 6px hsl(${195 + i * 15} 100% 55%)`,
                    transition: "width 0.5s",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly accuracy */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            HOURLY PREDICTION ACCURACY
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={metrics.hourlyAccuracy.filter((_, i) => i % 2 === 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(220 25% 62%)", fontSize: 8 }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, "Accuracy"]} />
              <Bar dataKey="accuracy" fill="hsl(185 100% 55%)" opacity={0.8} radius={[2, 2, 0, 0]}>
                {metrics.hourlyAccuracy.filter((_, i) => i % 2 === 0).map((entry, i) => (
                  <Cell key={i} fill={entry.accuracy > 95 ? "hsl(130 100% 55%)" : entry.accuracy > 90 ? "hsl(185 100% 60%)" : "hsl(45 100% 60%)"} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Traffic patterns */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
          AI INSIGHTS — TRAFFIC PATTERNS DETECTED
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { icon: "🌅", title: "Morning Rush Detected", desc: "7AM–9AM peak consistently requires Plan A. Prediction AI pre-activates extended green cycles.", tag: "PREDICTION" },
            { icon: "🏙️", title: "Intersection Bottleneck", desc: "Broadway East shows 28% higher congestion. Optimizer AI redistributes signal timing automatically.", tag: "OPTIMIZER" },
            { icon: "🌙", title: "Night Mode Trigger", desc: "After 11PM, vehicle count drops 70%. System auto-switches to Plan C with longer cycles.", tag: "RULE-BASED" },
            { icon: "⚡", title: "Emergency Override", desc: "Emergency vehicle detection triggers priority green for Main St North within 2s.", tag: "DETECTION" },
            { icon: "📊", title: "Weekly Pattern Learned", desc: "Friday evenings show 15% higher load. AI pre-adjusts predictions by day-of-week.", tag: "PREDICTION" },
            { icon: "🔄", title: "Adaptive Cycle Tuning", desc: "Green time optimized per-lane based on real-time density. Avg 23% improvement vs fixed timing.", tag: "OPTIMIZER" },
          ].map(insight => (
            <div key={insight.title} style={{ background: "rgba(2,8,26,0.70)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 6, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{insight.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "hsl(185 100% 75%)" }}>{insight.title}</div>
                  <span style={{
                    fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
                    background: "hsl(270 100% 65% / 0.15)", border: "1px solid hsl(270 100% 65% / 0.3)", color: "hsl(265 100% 74%)",
                  }}>{insight.tag}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", lineHeight: 1.5 }}>{insight.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
