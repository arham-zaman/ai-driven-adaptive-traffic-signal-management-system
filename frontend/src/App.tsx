import React, { useState } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AnalysisPage from "./pages/AnalysisPage";
import MonitoringPage from "./pages/MonitoringPage";
import ControlPage from "./pages/ControlPage";
import LogsPage from "./pages/LogsPage";
import AIAnalyticsPage from "./pages/AIAnalyticsPage";
import Sidebar from "./components/Sidebar";

type Page = "dashboard" | "analysis" | "monitoring" | "control" | "logs" | "ai";

const pageComponents: Record<Page, React.ComponentType> = {
  dashboard: DashboardPage,
  analysis: AnalysisPage,
  monitoring: MonitoringPage,
  control: ControlPage,
  logs: LogsPage,
  ai: AIAnalyticsPage,
};

const pageTitles: Record<Page, string> = {
  dashboard: "DASHBOARD",
  analysis: "GRAPHICAL ANALYSIS",
  monitoring: "LIVE MONITORING",
  control: "CONTROL PANEL",
  logs: "LOGS / HISTORY",
  ai: "AI ANALYTICS",
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  const PageComponent = pageComponents[activePage];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "transparent", position: "relative", zIndex: 1 }}>
      <Sidebar active={activePage} onNavigate={(p) => setActivePage(p as Page)} />

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top header */}
        <div style={{
          height: 52,
          background: "rgba(2,10,28,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,180,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 3, height: 20, background: "hsl(185 100% 55%)", boxShadow: "0 0 8px hsl(185 100% 55%)", borderRadius: 2 }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "hsl(185 100% 75%)" }}>
              {pageTitles[activePage]}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Live clock */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "monospace", fontSize: 14, color: "hsl(185 100% 75%)", fontWeight: 700, letterSpacing: "0.1em" }}>
                {currentTime.toLocaleTimeString("en", { hour12: false })}
              </div>
              <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", letterSpacing: "0.05em" }}>
                {currentTime.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>

            {/* System indicators */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "DETECTION", color: "hsl(120 100% 50%)" },
                { label: "PREDICTION", color: "hsl(120 100% 50%)" },
                { label: "OPTIMIZER", color: "hsl(120 100% 50%)" },
              ].map(ind => (
                <div key={ind.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: ind.color, boxShadow: `0 0 6px ${ind.color}` }} className="pulse-dot" />
                  <span style={{ fontSize: 9, color: "hsl(220 25% 62%)", letterSpacing: "0.05em" }}>{ind.label}</span>
                </div>
              ))}
            </div>

            {/* User */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg, hsl(195 100% 35%), hsl(215 28% 15%))",
                border: "1px solid hsl(195 100% 50% / 0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: "hsl(185 100% 75%)", fontWeight: 700,
              }}>A</div>
              <div>
                <div style={{ fontSize: 10, color: "hsl(185 100% 75%)", fontWeight: 600 }}>Admin</div>
                <div style={{ fontSize: 8, color: "hsl(220 25% 56%)" }}>Supervisor</div>
              </div>
              <button onClick={() => setLoggedIn(false)} style={{
                marginLeft: 4, padding: "3px 8px", borderRadius: 3, fontSize: 8, cursor: "pointer", fontFamily: "inherit",
                background: "hsl(0 100% 60% / 0.1)", border: "1px solid hsl(0 100% 60% / 0.3)", color: "hsl(0 100% 65%)", letterSpacing: "0.08em",
              }}>LOGOUT</button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <PageComponent />
        </div>

        {/* Status bar */}
        <div style={{
          height: 26,
          background: "rgba(2,8,22,0.80)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(0,180,255,0.15)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 20,
          flexShrink: 0,
        }}>
          {[
            "AI Adaptive Traffic Signal Management System",
            "FYP 2027",
            "Adaptive AI Engine",
            "4 Lanes Active",
          ].map((item, i) => (
            <React.Fragment key={item}>
              {i > 0 && <div style={{ width: 1, height: 12, background: "hsl(215 30% 20%)" }} />}
              <span style={{ fontSize: 9, color: "hsl(215 20% 40%)", letterSpacing: "0.05em" }}>{item}</span>
            </React.Fragment>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "hsl(120 100% 50%)", boxShadow: "0 0 6px hsl(120 100% 50%)" }} />
            <span style={{ fontSize: 9, color: "hsl(120 100% 55%)" }}>ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
