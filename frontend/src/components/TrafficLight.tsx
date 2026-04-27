import React from "react";
import type { SignalState } from "../lib/trafficData";

interface TrafficLightProps {
  signal: SignalState;
  label: string;
  timeRemaining: number;
  small?: boolean;
}

export default function TrafficLight({ signal, label, timeRemaining, small }: TrafficLightProps) {
  const size = small ? 20 : 28;
  const padding = small ? 6 : 8;
  const gap = small ? 4 : 6;
  const width = small ? 36 : 48;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: small ? 10 : 12, color: "hsl(185 80% 72%)", letterSpacing: "0.05em", textAlign: "center", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        background: "linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)",
        border: "2px solid hsl(220 40% 30%)",
        borderRadius: 10,
        padding,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap,
        width,
        boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
      }}>
        {(["RED", "YELLOW", "GREEN"] as SignalState[]).map(state => {
          const isActive = signal === state;
          const colors = {
            RED: { active: "radial-gradient(circle at 35% 35%, #ff6666, #cc0000)", glow: "0 0 20px #ff0000, 0 0 40px #ff000044", inactive: "radial-gradient(circle at 35% 35%, #440000, #220000)" },
            YELLOW: { active: "radial-gradient(circle at 35% 35%, #ffee66, #cc9900)", glow: "0 0 20px #ffcc00, 0 0 40px #ffcc0044", inactive: "radial-gradient(circle at 35% 35%, #443300, #221a00)" },
            GREEN: { active: "radial-gradient(circle at 35% 35%, #66ff66, #00cc00)", glow: "0 0 20px #00ff00, 0 0 40px #00ff0044", inactive: "radial-gradient(circle at 35% 35%, #004400, #002200)" },
          };
          return (
            <div key={state} style={{
              width: size, height: size,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.1)",
              background: isActive ? colors[state].active : colors[state].inactive,
              boxShadow: isActive ? colors[state].glow : "none",
              transition: "all 0.3s ease",
            }} />
          );
        })}
      </div>
      <div style={{
        fontSize: small ? 11 : 13,
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: signal === "GREEN" ? "hsl(130 100% 60%)" : signal === "RED" ? "hsl(0 100% 68%)" : "hsl(45 100% 60%)",
        textShadow: signal === "GREEN" ? "0 0 8px hsl(130 100% 60%)" : signal === "RED" ? "0 0 8px hsl(0 100% 68%)" : "0 0 8px hsl(45 100% 60%)",
      }}>
        {signal} ({timeRemaining}s)
      </div>
    </div>
  );
}
