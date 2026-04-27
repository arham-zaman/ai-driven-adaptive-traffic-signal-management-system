import React, { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { getHistoricalData } from "../lib/trafficData";

const COLORS = ["hsl(185 100% 60%)", "hsl(265 100% 70%)", "hsl(45 100% 60%)", "hsl(0 100% 68%)"];

const pieData = [
  { name: "Main St North", value: 35 },
  { name: "Broadway East", value: 28 },
  { name: "Main St South", value: 22 },
  { name: "Broadway West", value: 15 },
];

const tooltipStyle = {
  contentStyle: { background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 11 },
  labelStyle: { color: "hsl(185 100% 75%)" },
  itemStyle: { color: "hsl(185 100% 65%)" },
};

export default function AnalysisPage() {
  const [data] = useState(getHistoricalData());
  const [activeChart, setActiveChart] = useState("all");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 75%)" }}>GRAPHICAL ANALYSIS</div>
          <div style={{ fontSize: 10, color: "hsl(220 25% 62%)", marginTop: 2 }}>Historical traffic data · 24-hour analysis period</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "trend", "lane", "dist"].map(tab => (
            <button key={tab} onClick={() => setActiveChart(tab)} style={{
              padding: "5px 12px", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit",
              background: activeChart === tab ? "hsl(195 100% 50% / 0.2)" : "transparent",
              border: `1px solid ${activeChart === tab ? "hsl(195 100% 50% / 0.5)" : "hsl(220 40% 26%)"}`,
              color: activeChart === tab ? "hsl(185 100% 70%)" : "hsl(220 25% 62%)",
            }}>{tab.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Line chart - vehicles over time */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
          VEHICLE FLOW OVER TIME (24H)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="ga1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(185 100% 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(185 100% 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ga2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(265 100% 70%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(265 100% 70%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
            <XAxis dataKey="hour" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="vehicles" stroke="hsl(185 100% 60%)" strokeWidth={2} fill="url(#ga1)" name="Actual" />
            <Area type="monotone" dataKey="predicted" stroke="hsl(265 100% 70%)" strokeWidth={1.5} strokeDasharray="5 5" fill="url(#ga2)" name="Predicted" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Bar chart - lane-wise */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            LANE-WISE TRAFFIC DISTRIBUTION
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.filter((_, i) => i % 3 === 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="north" name="N. Main" fill="hsl(185 100% 60%)" opacity={0.85} />
              <Bar dataKey="east" name="Broadway E" fill="hsl(265 100% 70%)" opacity={0.85} />
              <Bar dataKey="south" name="S. Main" fill="hsl(45 100% 60%)" opacity={0.85} />
              <Bar dataKey="west" name="Broadway W" fill="hsl(0 100% 68%)" opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - distribution */}
        <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
            TRAFFIC DISTRIBUTION BY LANE
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} opacity={0.9} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(3,12,38,0.62)", border: "1px solid hsl(195 100% 50% / 0.3)", borderRadius: 6, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pieData.map((entry, i) => (
                <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i] }} />
                  <div>
                    <div style={{ fontSize: 9, color: "hsl(220 25% 66%)" }}>{entry.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS[i] }}>{entry.value}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trend analysis */}
      <div style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", marginBottom: 12 }}>
          PEAK HOUR TREND ANALYSIS
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 40% 24%)" />
            <XAxis dataKey="hour" tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fill: "hsl(220 25% 62%)", fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Line type="monotone" dataKey="north" stroke="hsl(185 100% 60%)" strokeWidth={2} dot={false} name="North" />
            <Line type="monotone" dataKey="east" stroke="hsl(265 100% 70%)" strokeWidth={2} dot={false} name="East" />
            <Line type="monotone" dataKey="south" stroke="hsl(45 100% 60%)" strokeWidth={2} dot={false} name="South" />
            <Line type="monotone" dataKey="west" stroke="hsl(0 100% 68%)" strokeWidth={2} dot={false} name="West" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "PEAK HOUR", value: "8:00 AM", sub: "Morning rush" },
          { label: "AVG FLOW", value: "624/h", sub: "All lanes combined" },
          { label: "BUSIEST LANE", value: "Main N", sub: "35% of total flow" },
          { label: "OFF-PEAK", value: "2:00 AM", sub: "Minimum traffic" },
        ].map(item => (
          <div key={item.label} style={{ background: "rgba(3,12,38,0.62)", border: "1px solid rgba(0,180,255,0.18)", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: "hsl(185 80% 64%)", letterSpacing: "0.12em" }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(185 100% 75%)", fontFamily: "monospace", marginTop: 2 }}>{item.value}</div>
            <div style={{ fontSize: 9, color: "hsl(220 25% 56%)" }}>{item.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
