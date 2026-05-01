import React, { useState, useEffect } from "react";
import { logsApi, LANE_DISPLAY } from "../lib/api";

const laneKeys  = ["north", "south", "east", "west"];
const laneNames = ["All Lanes", ...laneKeys.map(k => LANE_DISPLAY[k])];

export default function LogsPage() {
  const [signalLogs, setSignalLogs]   = useState<any[]>([]);
  const [predLogs, setPredLogs]       = useState<any[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
  const [summary, setSummary]         = useState<any>(null);
  const [activeTab, setActiveTab]     = useState<"signals" | "predictions" | "traffic">("signals");
  const [filterLane, setFilterLane]   = useState("All Lanes");
  const [search, setSearch]           = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const fetchAll = () => {
    const lane = filterLane === "All Lanes"
      ? undefined
      : laneKeys[laneNames.indexOf(filterLane) - 1];

    Promise.all([
      logsApi.getSignalLogs(100, lane),
      logsApi.getPredictionLogs(100, lane),
      logsApi.getTrafficLogs(100, lane),
      logsApi.getSummary(),
    ]).then(([sl, pl, tl, sum]) => {
      setSignalLogs(sl);
      setPredLogs(pl);
      setTrafficLogs(tl);
      setSummary(sum);
      setIsConnected(true);
    }).catch(() => setIsConnected(false));
  };

  useEffect(() => { fetchAll(); }, [filterLane]);
  useEffect(() => {
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, [filterLane]);

  const exportCSV = () => {
    const rows = signalLogs.map(l =>
      `${l.timestamp},${l.lane},${l.signal_state},${l.duration}s,${l.is_manual ? "MANUAL" : "AI"}`
    );
    const blob = new Blob(["Time,Lane,Signal,Duration,Mode\n" + rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "traffic_logs.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const signalColor = (s: string) =>
    s === "green" ? "hsl(130 100% 60%)" : s === "red" ? "hsl(0 100% 68%)" : "hsl(45 100% 65%)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>LOGS / HISTORY</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>
            Real database logs · Auto-updating every 5s
            <span style={{ marginLeft: 8, color: isConnected ? "hsl(130 100% 60%)" : "hsl(45 100% 65%)" }}>
              ● {isConnected ? "LIVE" : "Connecting..."}
            </span>
          </div>
        </div>
        <button onClick={exportCSV} style={{
          padding: "6px 14px", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          background: "hsl(195 100% 50% / 0.1)", border: "1px solid hsl(195 100% 50% / 0.3)", color: "hsl(185 100% 65%)",
        }}>EXPORT CSV</button>
      </div>

      {/* Summary stats */}
      {summary && (
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "TRAFFIC LOGS",   value: summary.total_traffic_logs,  color: "hsl(185 100% 70%)" },
            { label: "SIGNAL EVENTS",  value: summary.total_signal_events, color: "hsl(130 100% 60%)" },
            { label: "PREDICTIONS",    value: summary.total_predictions,   color: "hsl(265 100% 74%)" },
            { label: "MANUAL OVERRIDES", value: summary.manual_overrides,  color: "hsl(45 100% 65%)" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "monospace", marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "6px 12px", background: "rgba(2,9,28,0.68)", border: "1px solid hsl(220 40% 24%)", borderRadius: 5, color: "hsl(185 100% 75%)", fontSize: 11, outline: "none", fontFamily: "inherit", width: 200 }}
        />
        <select value={filterLane} onChange={e => setFilterLane(e.target.value)} style={{
          padding: "6px 10px", background: "rgba(2,9,28,0.68)", border: "1px solid hsl(220 40% 24%)",
          borderRadius: 5, color: "hsl(185 100% 75%)", fontSize: 11, outline: "none", fontFamily: "inherit",
        }}>
          {laneNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {/* Tab selector */}
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {(["signals", "predictions", "traffic"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "6px 12px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: activeTab === tab ? "hsl(195 100% 50% / 0.2)" : "transparent",
              border: `1px solid ${activeTab === tab ? "hsl(195 100% 50% / 0.5)" : "hsl(220 40% 26%)"}`,
              color: activeTab === tab ? "hsl(185 100% 70%)" : "hsl(220 25% 62%)",
            }}>{tab.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Signal logs table */}
      {activeTab === "signals" && (
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11 }}>
            <thead>
              <tr style={{ background: "rgba(2,8,26,0.70)", borderBottom: "1px solid hsl(220 40% 22%)" }}>
                {["TIME", "LANE", "SIGNAL STATE", "DURATION", "MODE"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left" as const, fontSize: 9, letterSpacing: "0.12em", color: "hsl(185 80% 68%)", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signalLogs.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center" as const, color: "hsl(220 25% 56%)" }}>
                  {isConnected ? "No signal events yet — start the timer!" : "Connecting to backend..."}
                </td></tr>
              ) : signalLogs.filter(l => !search || l.lane.includes(search.toLowerCase())).map((log, i) => (
                <tr key={log.id} style={{ borderBottom: "1px solid hsl(220 40% 18%)", background: i % 2 === 0 ? "transparent" : "hsl(222 35% 11%)" }}>
                  <td style={{ padding: "8px 12px", color: "hsl(220 25% 62%)", fontFamily: "monospace", fontSize: 10 }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td style={{ padding: "8px 12px", color: "hsl(185 100% 75%)" }}>{LANE_DISPLAY[log.lane] ?? log.lane}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: signalColor(log.signal_state), background: `${signalColor(log.signal_state)}22`, border: `1px solid ${signalColor(log.signal_state)}40` }}>
                      {log.signal_state?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "hsl(185 100% 70%)", fontFamily: "monospace" }}>{log.duration}s</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: log.is_manual ? "hsl(45 100% 65%)" : "hsl(130 100% 60%)", background: log.is_manual ? "hsl(45 100% 55% / 0.15)" : "hsl(130 100% 50% / 0.15)" }}>
                      {log.is_manual ? "MANUAL" : "AI"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Prediction logs */}
      {activeTab === "predictions" && (
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11 }}>
            <thead>
              <tr style={{ background: "rgba(2,8,26,0.70)", borderBottom: "1px solid hsl(220 40% 22%)" }}>
                {["TIME", "LANE", "PREDICTED GREEN", "ACTUAL GREEN", "DIFFERENCE", "MODEL"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left" as const, fontSize: 9, letterSpacing: "0.12em", color: "hsl(185 80% 68%)", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {predLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center" as const, color: "hsl(220 25% 56%)" }}>
                  {isConnected ? "No predictions yet — call /predictions/predict!" : "Connecting..."}
                </td></tr>
              ) : predLogs.filter(l => !search || l.lane.includes(search.toLowerCase())).map((log, i) => {
                const diff = log.actual_green_time != null
                  ? Math.abs(log.predicted_green_time - log.actual_green_time).toFixed(1)
                  : null;
                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid hsl(220 40% 18%)", background: i % 2 === 0 ? "transparent" : "hsl(222 35% 11%)" }}>
                    <td style={{ padding: "8px 12px", color: "hsl(220 25% 62%)", fontFamily: "monospace", fontSize: 10 }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td style={{ padding: "8px 12px", color: "hsl(185 100% 75%)" }}>{LANE_DISPLAY[log.lane] ?? log.lane}</td>
                    <td style={{ padding: "8px 12px", color: "hsl(130 100% 60%)", fontFamily: "monospace" }}>{log.predicted_green_time}s</td>
                    <td style={{ padding: "8px 12px", color: "hsl(185 100% 70%)", fontFamily: "monospace" }}>{log.actual_green_time ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: diff ? "hsl(45 100% 65%)" : "hsl(220 25% 56%)", fontFamily: "monospace" }}>{diff ? `${diff}s` : "—"}</td>
                    <td style={{ padding: "8px 12px", color: "hsl(265 100% 74%)", fontSize: 9 }}>{log.model_used}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Traffic logs */}
      {activeTab === "traffic" && (
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11 }}>
            <thead>
              <tr style={{ background: "rgba(2,8,26,0.70)", borderBottom: "1px solid hsl(220 40% 22%)" }}>
                {["TIME", "LANE", "VEHICLES", "QUEUE", "DENSITY"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left" as const, fontSize: 9, letterSpacing: "0.12em", color: "hsl(185 80% 68%)", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trafficLogs.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center" as const, color: "hsl(220 25% 56%)" }}>No traffic logs yet</td></tr>
              ) : trafficLogs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: "1px solid hsl(220 40% 18%)", background: i % 2 === 0 ? "transparent" : "hsl(222 35% 11%)" }}>
                  <td style={{ padding: "8px 12px", color: "hsl(220 25% 62%)", fontFamily: "monospace", fontSize: 10 }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td style={{ padding: "8px 12px", color: "hsl(185 100% 75%)" }}>{LANE_DISPLAY[log.lane] ?? log.lane}</td>
                  <td style={{ padding: "8px 12px", color: "hsl(185 100% 70%)", fontFamily: "monospace" }}>{log.vehicle_count}</td>
                  <td style={{ padding: "8px 12px", color: "hsl(185 100% 70%)", fontFamily: "monospace" }}>{log.queue_length}</td>
                  <td style={{ padding: "8px 12px", color: "hsl(185 100% 70%)", fontFamily: "monospace" }}>{log.density?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}