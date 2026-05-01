import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend
} from "recharts";
import { predictionsApi, signalsApi, LANE_DISPLAY, LANE_KEYS } from "../lib/api";

const COLORS = ["hsl(185 100% 60%)", "hsl(265 100% 70%)", "hsl(45 100% 60%)", "hsl(0 100% 68%)"];

const tooltipStyle = {
  contentStyle: { background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 11 },
  labelStyle: { color: "hsl(185 100% 75%)" },
  itemStyle: { color: "hsl(185 100% 65%)" },
};

// ── Real model results from evaluate_improved.py ──────────────
const MODEL_ACCURACY = [
  { model: "LSTM",      acc: 85.0,  type: "Deep Learning",  color: "hsl(185 100% 55%)", detail: "Sequence-based temporal" },
  { model: "GRU",       acc: 85.0,  type: "Deep Learning",  color: "hsl(265 100% 70%)", detail: "Lightweight, fast" },
  { model: "RF",        acc: 91.16, type: "Ensemble",        color: "hsl(45 100% 60%)",  detail: "SMOTE + Optuna tuned" },
  { model: "XGBoost",   acc: 88.85, type: "Boosting",        color: "hsl(130 100% 55%)", detail: "Best overall (tuned)" },
];

// ── Real XGBoost feature importances from evaluate.py output ──
const FEATURE_IMPORTANCE = [
  { feature: "Queue Length",      importance: 55.5,  color: "hsl(185 100% 60%)" },
  { feature: "Congestion Ratio",  importance: 30.5,  color: "hsl(265 100% 70%)" },
  { feature: "Density",           importance: 10.6,  color: "hsl(45 100% 60%)" },
  { feature: "Count Change",      importance: 3.4,   color: "hsl(0 100% 68%)" },
];

// ── GRU green time prediction breakdown ───────────────────────
const GRU_BREAKDOWN = [
  { range: "Light (10-20s)",  mae: 2.22, label: "Light Traffic" },
  { range: "Normal (20-40s)", mae: 2.78, label: "Normal Traffic ⭐" },
  { range: "Heavy (40-60s)",  mae: 3.46, label: "Heavy Traffic" },
];

// ── Radar data for model comparison ───────────────────────────
const RADAR_DATA = [
  { metric: "Accuracy",    LSTM: 85, GRU: 85, RF: 91, XGB: 89 },
  { metric: "Speed",       LSTM: 60, GRU: 80, RF: 70, XGB: 75 },
  { metric: "Robustness",  LSTM: 70, GRU: 70, RF: 88, XGB: 85 },
  { metric: "Imbalance",   LSTM: 65, GRU: 65, RF: 90, XGB: 88 },
  { metric: "Tuning",      LSTM: 70, GRU: 70, RF: 85, XGB: 90 },
];

export default function AnalysisPage() {
  const [predStats, setPredStats]     = useState<Record<string, any>>({});
  const [signalStats, setSignalStats] = useState<Record<string, any>>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    Promise.all([
      predictionsApi.getStats(),
      signalsApi.getStats(),
    ]).then(([ps, ss]) => {
      setPredStats(ps);
      setSignalStats(ss);
      setIsConnected(true);
    }).catch(() => setIsConnected(false));

    const t = setInterval(() => {
      predictionsApi.getStats().then(setPredStats).catch(() => {});
      signalsApi.getStats().then(setSignalStats).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, []);

  // Per-lane avg predicted green time from real backend
  const laneGreenTimeData = LANE_KEYS.map((lane, i) => ({
    lane: lane.toUpperCase(),
    avg:  predStats[lane]?.avg ?? 0,
    count: predStats[lane]?.count ?? 0,
    fill: COLORS[i],
  }));

  const hasRealData = laneGreenTimeData.some(d => d.avg > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>MODEL PERFORMANCE REPORT</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>Real evaluation results · FYP 2027 · AI Adaptive Traffic System</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: isConnected ? "hsl(130 100% 55%)" : "hsl(45 100% 60%)", boxShadow: isConnected ? "0 0 8px hsl(130 100% 55%)" : "0 0 8px hsl(45 100% 60%)" }} className="pulse-dot" />
          <span style={{ fontSize: 9, color: isConnected ? "hsl(130 100% 60%)" : "hsl(45 100% 65%)" }}>
            {isConnected ? "LIVE STATS" : "STATIC RESULTS"}
          </span>
        </div>
      </div>

      {/* ── Model Accuracy Comparison ── */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
          MODEL ACCURACY COMPARISON — TRAFFIC CLASSIFICATION
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {MODEL_ACCURACY.map(m => (
            <div key={m.model} style={{ flex: 1, background: "rgba(2,8,26,0.70)", border: `1px solid ${m.color}44`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: m.color, borderRadius: "8px 8px 0 0" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: m.color, marginBottom: 2 }}>{m.model}</div>
              <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", marginBottom: 8 }}>{m.type}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: "monospace", textShadow: `0 0 15px ${m.color}66` }}>
                {m.acc.toFixed(1)}%
              </div>
              <div style={{ marginTop: 6, background: "rgba(0,0,0,0.5)", borderRadius: 3, height: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(m.acc - 80) / 20 * 100}%`, background: m.color, boxShadow: `0 0 6px ${m.color}`, transition: "width 0.8s" }} />
              </div>
              <div style={{ fontSize: 8, color: "hsl(220 25% 50%)", marginTop: 4 }}>{m.detail}</div>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={MODEL_ACCURACY} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
            <XAxis dataKey="model" tick={{ fill: "hsl(220 25% 62%)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[80, 96]} tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, "Accuracy"]} />
            <Bar dataKey="acc" radius={[4, 4, 0, 0]}>
              {MODEL_ACCURACY.map((m, i) => (
                <Cell key={i} fill={m.color} opacity={0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Feature Importance */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            XGBOOST FEATURE IMPORTANCE
          </div>
          {FEATURE_IMPORTANCE.map((f, i) => (
            <div key={f.feature} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "hsl(185 80% 72%)" }}>{f.feature}</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: f.color }}>{f.importance}%</span>
              </div>
              <div style={{ background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 8, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${f.importance}%`,
                  background: f.color, boxShadow: `0 0 6px ${f.color}`, transition: "width 0.8s"
                }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(0,180,255,0.06)", borderRadius: 5, border: "1px solid rgba(0,180,255,0.15)" }}>
            <div style={{ fontSize: 9, color: "hsl(220 25% 56%)" }}>Queue Length dominates (55.5%) — validates our feature engineering approach</div>
          </div>
        </div>

        {/* GRU Green Time MAE Breakdown */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 4 }}>
            GRU — GREEN TIME PREDICTION MAE
          </div>
          <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", marginBottom: 12 }}>
            Huber Weighted Loss · Overall MAE: 2.89s (+74% vs baseline 11.24s)
          </div>
          {GRU_BREAKDOWN.map((g, i) => {
            const colors = ["hsl(185 100% 60%)", "hsl(130 100% 55%)", "hsl(0 100% 68%)"];
            const c = colors[i];
            return (
              <div key={g.range} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "hsl(185 80% 72%)" }}>{g.label}</span>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: c, fontWeight: 700 }}>{g.mae}s MAE</span>
                </div>
                <div style={{ background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(g.mae / 5) * 100}%`, background: c, boxShadow: `0 0 6px ${c}`, transition: "width 0.8s" }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(0,200,100,0.06)", borderRadius: 5, border: "1px solid rgba(0,200,100,0.2)" }}>
            <div style={{ fontSize: 9, color: "hsl(130 100% 60%)", fontWeight: 700 }}>✓ Target: Normal traffic (20-40s) — MAE only 2.78s</div>
            <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", marginTop: 2 }}>Weighted loss prioritizes this critical range</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Radar Chart */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            MODEL CAPABILITY COMPARISON
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="hsl(220 40% 24%)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "hsl(220 25% 56%)", fontSize: 8 }} />
              <Radar name="RF"      dataKey="RF"   stroke="hsl(45 100% 60%)"   fill="hsl(45 100% 60%)"   fillOpacity={0.15} strokeWidth={2} />
              <Radar name="XGBoost" dataKey="XGB"  stroke="hsl(130 100% 55%)"  fill="hsl(130 100% 55%)"  fillOpacity={0.15} strokeWidth={2} />
              <Radar name="GRU"     dataKey="GRU"  stroke="hsl(265 100% 70%)"  fill="hsl(265 100% 70%)"  fillOpacity={0.12} strokeWidth={1.5} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Live Per-Lane Stats from backend */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            {hasRealData ? "LIVE PER-LANE PREDICTION STATS" : "PER-LANE AVG PREDICTED GREEN TIME"}
          </div>
          {!hasRealData ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160, gap: 8 }}>
              <div style={{ fontSize: 24 }}>📡</div>
              <div style={{ fontSize: 11, color: "hsl(45 100% 65%)" }}>Waiting for predictions...</div>
              <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", textAlign: "center" as const }}>Run demo_runner.py to populate this chart</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={laneGreenTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
                <XAxis dataKey="lane" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 60]} tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number, n: string, props: any) => [
                  `${v}s avg (${props.payload.count} predictions)`, "Avg Green Time"
                ]} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {laneGreenTimeData.map((d, i) => (
                    <Cell key={i} fill={d.fill} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Summary Improvements Table ── */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
          IMPROVEMENT SUMMARY — FYP CONTRIBUTIONS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "GRU MAE IMPROVEMENT", value: "+74%", sub: "11.24s → 2.89s", color: "hsl(130 100% 60%)" },
            { label: "BEST CLASSIFIER",     value: "91.16%", sub: "Random Forest (SMOTE+Optuna)", color: "hsl(45 100% 65%)" },
            { label: "FEATURE IMPORTANCE",  value: "55.5%", sub: "Queue Length dominates", color: "hsl(185 100% 70%)" },
            { label: "CLASS BALANCE",       value: "SMOTE", sub: "Synthetic minority oversampling", color: "hsl(265 100% 74%)" },
          ].map(item => (
            <div key={item.label} style={{ background: "rgba(2,8,26,0.70)", border: "1px solid rgba(0,180,255,0.15)", borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: "hsl(185 80% 64%)", letterSpacing: "0.1em" }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: "monospace", marginTop: 2 }}>{item.value}</div>
              <div style={{ fontSize: 9, color: "hsl(220 25% 56%)" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}