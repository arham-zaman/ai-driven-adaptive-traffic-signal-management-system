import React, { useState, useEffect } from "react";
import { getLogs, type LogEntry } from "../lib/trafficData";

const laneNames = ["All Lanes", "Main St North", "Broadway East", "Main St South", "Broadway West"];

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>(getLogs());
  const [filterLane, setFilterLane] = useState("All Lanes");
  const [filterSignal, setFilterSignal] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setLogs([...getLogs()]), 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = logs.filter(log => {
    if (filterLane !== "All Lanes" && log.lane !== filterLane) return false;
    if (filterSignal !== "ALL" && log.signal !== filterSignal) return false;
    if (search && !log.lane.toLowerCase().includes(search.toLowerCase()) && !log.aiAction.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportCSV = () => {
    const header = "Time,Lane,Vehicles,Density,Signal,Green Time,AI Action\n";
    const rows = filtered.map(l => `${l.time},${l.lane},${l.vehicles},${l.density},${l.signal},${l.greenTime}s,${l.aiAction}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "traffic_logs.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const signalColor = (s: string) => s === "GREEN" ? "hsl(130 100% 60%)" : s === "RED" ? "hsl(0 100% 68%)" : "hsl(45 100% 65%)";
  const densityColor = (d: string) => d === "HIGH" ? "hsl(0 100% 68%)" : d === "MEDIUM" ? "hsl(45 100% 65%)" : "hsl(130 100% 60%)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>LOGS / HISTORY</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>{filtered.length} records · Auto-updating every 3s</div>
        </div>
        <button onClick={exportCSV} style={{
          padding: "6px 14px", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          background: "hsl(195 100% 50% / 0.1)", border: "1px solid hsl(195 100% 50% / 0.3)", color: "hsl(185 100% 65%)", letterSpacing: "0.1em",
        }}>EXPORT CSV</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="text" placeholder="Search logs..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            padding: "6px 12px", background: "rgba(2,9,28,0.68)", border: "1px solid hsl(220 40% 24%)",
            borderRadius: 5, color: "hsl(185 100% 75%)", fontSize: 11, outline: "none", fontFamily: "inherit", width: 200,
          }}
        />
        <select value={filterLane} onChange={e => setFilterLane(e.target.value)} style={{
          padding: "6px 10px", background: "rgba(2,9,28,0.68)", border: "1px solid hsl(220 40% 24%)",
          borderRadius: 5, color: "hsl(185 100% 75%)", fontSize: 11, outline: "none", fontFamily: "inherit", cursor: "pointer",
        }}>
          {laneNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filterSignal} onChange={e => setFilterSignal(e.target.value)} style={{
          padding: "6px 10px", background: "rgba(2,9,28,0.68)", border: "1px solid hsl(220 40% 24%)",
          borderRadius: 5, color: "hsl(185 100% 75%)", fontSize: 11, outline: "none", fontFamily: "inherit", cursor: "pointer",
        }}>
          {["ALL", "GREEN", "RED", "YELLOW"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => { setFilterLane("All Lanes"); setFilterSignal("ALL"); setSearch(""); }} style={{
          padding: "6px 12px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
          background: "transparent", border: "1px solid hsl(220 40% 26%)", color: "hsl(220 25% 66%)",
        }}>CLEAR</button>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "TOTAL EVENTS", value: logs.length, color: "hsl(185 100% 70%)" },
          { label: "GREEN SIGNALS", value: logs.filter(l => l.signal === "GREEN").length, color: "hsl(130 100% 60%)" },
          { label: "RED SIGNALS", value: logs.filter(l => l.signal === "RED").length, color: "hsl(0 100% 68%)" },
          { label: "HIGH DENSITY", value: logs.filter(l => l.density === "HIGH").length, color: "hsl(45 100% 65%)" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 6, padding: "8px 12px" }}>
            <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", letterSpacing: "0.1em" }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "monospace", marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "rgba(2,8,26,0.70)", borderBottom: "1px solid hsl(220 40% 22%)" }}>
                {["TIME", "LANE", "VEHICLES", "DENSITY", "SIGNAL", "GREEN TIME", "AI ACTION"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 9, letterSpacing: "0.12em", color: "hsl(185 80% 68%)", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "hsl(220 25% 56%)", fontSize: 12 }}>No matching records found</td></tr>
              ) : (
                filtered.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid hsl(220 40% 18%)", background: i % 2 === 0 ? "transparent" : "hsl(222 35% 11%)" }}>
                    <td style={{ padding: "8px 12px", color: "hsl(220 25% 62%)", fontFamily: "monospace", fontSize: 10 }}>{log.time}</td>
                    <td style={{ padding: "8px 12px", color: "hsl(185 100% 75%)" }}>{log.lane}</td>
                    <td style={{ padding: "8px 12px", color: "hsl(185 100% 70%)", fontFamily: "monospace" }}>{log.vehicles}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700,
                        color: densityColor(log.density),
                        background: log.density === "HIGH" ? "hsl(0 100% 60% / 0.15)" : log.density === "MEDIUM" ? "hsl(50 100% 55% / 0.15)" : "hsl(120 100% 50% / 0.15)",
                        border: `1px solid ${densityColor(log.density)}40`,
                      }}>{log.density}</span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700,
                        color: signalColor(log.signal),
                        background: log.signal === "GREEN" ? "hsl(120 100% 50% / 0.15)" : log.signal === "RED" ? "hsl(0 100% 60% / 0.15)" : "hsl(50 100% 55% / 0.15)",
                        border: `1px solid ${signalColor(log.signal)}40`,
                      }}>{log.signal}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "hsl(185 100% 70%)", fontFamily: "monospace" }}>{log.greenTime}s</td>
                    <td style={{ padding: "8px 12px", color: "hsl(220 25% 66%)", fontSize: 10, maxWidth: 200 }}>{log.aiAction}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
