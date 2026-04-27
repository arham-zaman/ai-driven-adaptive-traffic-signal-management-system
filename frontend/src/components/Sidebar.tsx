import React from "react";

interface SidebarProps {
  active: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "dashboard", icon: "📊", label: "DASHBOARD",          color: "hsl(185 100% 60%)" },
  { id: "analysis",  icon: "📈", label: "GRAPHICAL ANALYSIS", color: "hsl(265 100% 72%)" },
  { id: "monitoring",icon: "🚦", label: "LIVE MONITORING",    color: "hsl(130 100% 58%)" },
  { id: "control",   icon: "⚙️", label: "CONTROL PANEL",      color: "hsl(45 100% 60%)" },
  { id: "logs",      icon: "📜", label: "LOGS / HISTORY",     color: "hsl(200 100% 62%)" },
  { id: "ai",        icon: "🧠", label: "AI ANALYTICS",       color: "hsl(320 100% 65%)" },
];

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside style={{
      width: 224,
      minWidth: 224,
      background: "rgba(2,8,24,0.80)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderRight: "1px solid rgba(0,180,255,0.20)",
      display: "flex",
      flexDirection: "column",
      padding: "0 12px 24px",
      gap: 3,
      boxShadow: "4px 0 30px rgba(0,180,255,0.10), 4px 0 8px rgba(0,0,0,0.5)",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 8px 22px", borderBottom: "1px solid hsl(220 40% 18%)", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "radial-gradient(circle at 40% 40%, hsl(185 100% 30%), hsl(222 42% 10%))",
            border: "2px solid hsl(185 100% 58%)",
            boxShadow: "0 0 18px hsl(185 100% 55% / 0.6), 0 0 40px hsl(185 100% 55% / 0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🚦</div>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
              color: "hsl(185 100% 70%)",
              textShadow: "0 0 12px hsl(185 100% 65% / 0.9)",
            }}>AI ADAPTIVE</div>
            <div style={{ fontSize: 9, color: "hsl(185 80% 65%)", letterSpacing: "0.06em", marginTop: 1 }}>
              TRAFFIC SIGNAL SYSTEM
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      {navItems.map(item => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 14px", borderRadius: 8, cursor: "pointer",
              transition: "all 0.2s ease",
              border: `1px solid ${isActive ? `${item.color.replace(")", " / 0.5)")}` : "transparent"}`,
              background: isActive
                ? `linear-gradient(135deg, ${item.color.replace(")", " / 0.14)")}, ${item.color.replace(")", " / 0.06)")})`
                : "transparent",
              color: isActive ? item.color : "hsl(220 25% 60%)",
              fontFamily: "inherit",
              width: "100%", textAlign: "left",
              boxShadow: isActive ? `0 0 16px ${item.color.replace(")", " / 0.2)")}` : "none",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = `${item.color.replace(")", " / 0.08)")}`;
                (e.currentTarget as HTMLButtonElement).style.color = item.color;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${item.color.replace(")", " / 0.25)")}`;
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "hsl(220 25% 60%)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
              }
            }}
          >
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em" }}>{item.label}</span>
            {isActive && (
              <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: item.color, boxShadow: `0 0 8px ${item.color}` }} className="pulse-dot" />
            )}
          </button>
        );
      })}

      {/* Divider */}
      <div style={{ borderTop: "1px solid hsl(220 40% 18%)", margin: "8px 0" }} />

      {/* Bottom status */}
      <div style={{ padding: "4px 8px 0" }}>
        <div style={{ fontSize: 9, color: "hsl(220 25% 45%)", marginBottom: 8, letterSpacing: "0.12em", fontWeight: 600 }}>SYSTEM STATUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "hsl(130 100% 55%)", boxShadow: "0 0 10px hsl(130 100% 55%)" }} className="pulse-dot" />
          <span style={{ fontSize: 10, color: "hsl(130 100% 60%)", fontWeight: 700, letterSpacing: "0.05em" }}>ALL SYSTEMS ONLINE</span>
        </div>
        {[
          { label: "Detection AI",  color: "hsl(265 100% 72%)" },
          { label: "Prediction AI", color: "hsl(185 100% 65%)" },
          { label: "Optimizer AI",  color: "hsl(45 100% 60%)" },
        ].map(m => (
          <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
            <span style={{ fontSize: 9, color: m.color }}>{m.label} Active</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
