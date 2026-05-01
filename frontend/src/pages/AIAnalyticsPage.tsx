import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { predictionsApi, signalsApi, logsApi, LANE_DISPLAY, LANE_KEYS } from "../lib/api";

const tooltipStyle = {
  contentStyle: { background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 11 },
  labelStyle: { color: "hsl(185 100% 75%)" },
};

export default function AIAnalyticsPage() {
  const [predStats, setPredStats]       = useState<Record<string, any>>({});
  const [signalStats, setSignalStats]   = useState<Record<string, any>>({});
  const [summary, setSummary]           = useState<any>(null);
  const [isConnected, setIsConnected]   = useState(false);
  const [predLogs, setPredLogs]         = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = () => {
      Promise.all([
        predictionsApi.getStats(),
        signalsApi.getStats(),
        logsApi.getSummary(),
        fetch("http://localhost:8000/predictions/?limit=50").then(r => r.json()).catch(() => []),
      ]).then(([ps, ss, sum, logs]) => {
        setPredStats(ps);
        setSignalStats(ss);
        setSummary(sum);
        if (Array.isArray(logs)) setPredLogs(logs);
        setIsConnected(true);
      }).catch(() => setIsConnected(false));
    };

    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, []);

  // Real stats
  const totalPredictions = summary?.total_predictions ?? 0;
  const totalSignals     = summary?.total_signal_events ?? 0;
  const manualOverrides  = summary?.manual_overrides ?? 0;
  const avgError         = summary?.avg_prediction_error ?? "—";

  // Per-lane prediction chart data
  const predChartData = LANE_KEYS.map((lane, i) => ({
    lane: lane.toUpperCase(),
    avg:  predStats[lane]?.avg ?? 0,
    max:  predStats[lane]?.max ?? 0,
    min:  predStats[lane]?.min ?? 0,
    count: predStats[lane]?.count ?? 0,
  }));

  // Signal cycles per lane
  const signalChartData = LANE_KEYS.map((lane, i) => ({
    lane:   lane.toUpperCase(),
    cycles: signalStats[lane]?.total_cycles ?? 0,
    avg:    signalStats[lane]?.avg_green_time ?? 0,
    manual: signalStats[lane]?.manual_overrides ?? 0,
  }));

  // Prediction trend (green time over time from real logs)
  const predTrend = predLogs.slice(-20).map((p: any) => ({
    t: new Date(p.timestamp).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    green: p.predicted_green_time,
    lane: p.lane,
  }));

  const hasRealPredData = predLogs.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(270 100% 75%)" }}>AI ANALYTICS</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>Live backend stats · Real model performance · FYP 2027</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%",
            background: isConnected ? "hsl(130 100% 55%)" : "hsl(45 100% 60%)",
            boxShadow: isConnected ? "0 0 8px hsl(130 100% 55%)" : "0 0 8px hsl(45 100% 60%)"
          }} className="pulse-dot" />
          <span style={{ fontSize: 9, color: isConnected ? "hsl(130 100% 60%)" : "hsl(45 100% 65%)" }}>
            {isConnected ? "LIVE DATA" : "CONNECTING..."}
          </span>
        </div>
      </div>

      {/* Key metrics — real data */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "TOTAL PREDICTIONS",  value: totalPredictions.toLocaleString(), color: "hsl(130 100% 60%)", sub: "AI green time predictions made" },
          { label: "SIGNAL EVENTS",      value: totalSignals.toLocaleString(),      color: "hsl(185 100% 70%)", sub: "Total signal phase changes" },
          { label: "MANUAL OVERRIDES",   value: manualOverrides.toLocaleString(),   color: "hsl(45 100% 65%)",  sub: "Human interventions" },
          { label: "AVG PREDICTION ERR", value: avgError,                           color: "hsl(265 100% 74%)", sub: "Predicted vs actual green time" },
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

      {/* Model cards — honest about what each model does */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { name: "GRU (Improved)",    role: "Green Time Regressor",        color: "hsl(185 100% 65%)", metric: "MAE: 2.89s",  detail: "Huber Weighted Loss", badge: "ACTIVE", badgeColor: "hsl(130 100% 60%)" },
          { name: "LSTM",              role: "Temporal Pattern Analyzer",    color: "hsl(130 100% 60%)", metric: "Seq: 10 steps", detail: "64 units, 2 layers",  badge: "ACTIVE", badgeColor: "hsl(130 100% 60%)" },
          { name: "XGBoost (Tuned)",   role: "Traffic Classifier",           color: "hsl(45 100% 60%)",  metric: "Acc: 88.85%", detail: "Optuna tuned + SMOTE",  badge: "BEST CLF", badgeColor: "hsl(45 100% 60%)" },
          { name: "Random Forest",     role: "Traffic Classifier",           color: "hsl(265 100% 74%)", metric: "Acc: 91.16%", detail: "Optuna tuned + SMOTE",  badge: "BEST CLF", badgeColor: "hsl(45 100% 60%)" },
        ].map(model => (
          <div key={model.name} style={{ flex: 1, background: "rgba(3,12,38,0.62)", border: `1px solid ${model.color}30`, borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: model.color, letterSpacing: "0.05em" }}>{model.name}</div>
                <div style={{ fontSize: 9, color: "hsl(220 25% 62%)", marginTop: 1 }}>{model.role}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, fontWeight: 700,
                  color: model.badgeColor, background: `${model.badgeColor}20`, border: `1px solid ${model.badgeColor}44`
                }}>{model.badge}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 9, color: "hsl(220 25% 56%)" }}>Performance</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(185 100% 75%)", fontFamily: "monospace", marginTop: 2 }}>{model.metric}</div>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <div style={{ fontSize: 8, color: "hsl(220 25% 56%)" }}>Config</div>
                <div style={{ fontSize: 9, color: "hsl(185 80% 68%)", marginTop: 2 }}>{model.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System uses: GRU + XGBoost blend explanation */}
      <div style={{ padding: "10px 16px", background: "rgba(0,180,255,0.06)", border: "1px solid rgba(0,180,255,0.2)", borderRadius: 8, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ fontSize: 20 }}>🧠</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "hsl(185 100% 75%)", fontWeight: 700, marginBottom: 2 }}>
            How the AI Pipeline Works
          </div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)" }}>
            For each lane: <span style={{ color: "hsl(185 100% 75%)" }}>GRU predicts exact green time</span> (10–60s) →
            <span style={{ color: "hsl(45 100% 65%)" }}> XGBoost classifies traffic level</span> (LOW/MEDIUM/HIGH) →
            <span style={{ color: "hsl(130 100% 60%)" }}> Final = 60% GRU + 40% XGBoost blend</span> →
            Signal controller sets adaptive green time
          </div>
        </div>
        <div style={{ fontSize: 10, color: "hsl(130 100% 60%)", fontWeight: 700, whiteSpace: "nowrap" as const }}>60/40 BLEND</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Avg predicted green time per lane — real */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            AVG PREDICTED GREEN TIME PER LANE
          </div>
          {predChartData.every(d => d.avg === 0) ? (
            <div style={{ color: "hsl(220 25% 56%)", fontSize: 10, padding: "20px 0", textAlign: "center" as const }}>
              No predictions yet — run demo_runner.py
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={predChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
                <XAxis dataKey="lane" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 60]} tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number, n: string, props: any) => [
                  `${v}s avg (${props.payload.count} predictions)`, "Avg Green Time"
                ]} />
                <Bar dataKey="avg" radius={[3, 3, 0, 0]}>
                  {predChartData.map((_, i) => (
                    <Cell key={i} fill={["hsl(185 100% 55%)", "hsl(265 100% 70%)", "hsl(45 100% 60%)", "hsl(0 100% 68%)"][i]} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Signal cycles per lane */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            SIGNAL CYCLES PER LANE
          </div>
          {signalChartData.every(d => d.cycles === 0) ? (
            <div style={{ color: "hsl(220 25% 56%)", fontSize: 10, padding: "20px 0", textAlign: "center" as const }}>
              No signal events yet — start the timer
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={signalChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
                <XAxis dataKey="lane" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Signal Cycles"]} />
                <Bar dataKey="cycles" radius={[3, 3, 0, 0]}>
                  {signalChartData.map((_, i) => (
                    <Cell key={i} fill={["hsl(185 100% 55%)", "hsl(265 100% 70%)", "hsl(45 100% 60%)", "hsl(0 100% 68%)"][i]} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Real prediction trend over time */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)" }}>
            PREDICTION HISTORY — GREEN TIME OVER TIME
          </div>
          <span style={{ fontSize: 9, color: hasRealPredData ? "hsl(130 100% 60%)" : "hsl(45 100% 65%)",
            padding: "2px 8px", borderRadius: 4, border: `1px solid ${hasRealPredData ? "hsl(130 100% 50%/0.3)" : "hsl(45 100% 50%/0.3)"}` }}>
            {hasRealPredData ? `${predLogs.length} records` : "WAITING FOR DATA"}
          </span>
        </div>
        {!hasRealPredData ? (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, color: "hsl(220 25% 56%)" }}>Run demo_runner.py to populate prediction history</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={predTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
              <XAxis dataKey="t" tick={{ fill: "hsl(220 25% 62%)", fontSize: 8 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis domain={[10, 60]} tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}s`, "Predicted Green Time"]} />
              <Line type="monotone" dataKey="green" stroke="hsl(185 100% 60%)" strokeWidth={2} dot={false} name="Green Time (s)" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Feature importance (static real values from evaluate.py) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            XGBOOST FEATURE IMPORTANCE (evaluate.py)
          </div>
          {[
            { feature: "Queue Length",      importance: 0.555 },
            { feature: "Congestion Ratio",  importance: 0.305 },
            { feature: "Density",           importance: 0.106 },
            { feature: "Count Change",      importance: 0.034 },
          ].map((f, i) => (
            <div key={f.feature} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "hsl(185 80% 72%)" }}>{f.feature}</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "hsl(185 100% 75%)" }}>{(f.importance * 100).toFixed(1)}%</span>
              </div>
              <div style={{ background: "rgba(2,6,20,0.75)", borderRadius: 3, height: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${f.importance * 100}%`, background: `hsl(${195 + i * 20} 100% 55%)`, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            MODEL ACCURACY — REAL RESULTS
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { model: "LSTM",   acc: 85.0,  color: "hsl(185 100% 55%)" },
              { model: "GRU",    acc: 85.0,  color: "hsl(265 100% 70%)" },
              { model: "RF",     acc: 91.16, color: "hsl(45 100% 60%)" },
              { model: "XGB",    acc: 88.85, color: "hsl(130 100% 55%)" },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
              <XAxis dataKey="model" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 96]} tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, "Accuracy"]} />
              <Bar dataKey="acc" radius={[3, 3, 0, 0]}>
                {["hsl(185 100% 55%)", "hsl(265 100% 70%)", "hsl(45 100% 60%)", "hsl(130 100% 55%)"].map((color, i) => (
                  <Cell key={i} fill={color} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}