import React, { useState } from "react";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError("");
    setLoading(true);
    setTimeout(() => {
      if (username === "admin" && password === "admin123") {
        onLogin();
      } else {
        setError("Invalid credentials. Use: admin / admin123");
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="login-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Animated grid lines */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: `${i * 20}%`, top: 0, bottom: 0,
            width: 1, background: "linear-gradient(180deg, transparent, hsl(195 100% 50% / 0.08), transparent)",
            animation: `pulse ${2 + i * 0.3}s infinite alternate`,
          }} />
        ))}
      </div>

      <div style={{
        width: "100%", maxWidth: 420, padding: "0 20px",
        position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 70, height: 70, borderRadius: "50%",
            background: "radial-gradient(circle, hsl(195 100% 25%), hsl(222 38% 10%))",
            border: "2px solid hsl(185 100% 55%)",
            boxShadow: "0 0 30px hsl(195 100% 50% / 0.6), 0 0 60px hsl(195 100% 50% / 0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, margin: "0 auto 16px",
          }}>🚦</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", color: "hsl(185 100% 70%)", textShadow: "0 0 20px hsl(195 100% 65% / 0.8)", margin: 0 }}>
            AI ADAPTIVE TRAFFIC
          </h1>
          <p style={{ fontSize: 12, color: "hsl(185 80% 64%)", letterSpacing: "0.2em", margin: "4px 0 0" }}>
            SIGNAL MANAGEMENT SYSTEM
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(130 100% 55%)", boxShadow: "0 0 8px hsl(130 100% 55%)" }} className="pulse-dot" />
            <span style={{ fontSize: 10, color: "hsl(130 100% 60%)", letterSpacing: "0.1em" }}>SYSTEM ONLINE · FYP 2027</span>
          </div>
        </div>

        {/* Login card */}
        <div style={{
          background: "linear-gradient(135deg, hsl(222 35% 14%), hsl(222 35% 11%))",
          border: "1px solid hsl(195 100% 50% / 0.3)",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 0 40px hsl(195 100% 50% / 0.1), 0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.15em", color: "hsl(185 80% 72%)", marginBottom: 24, textAlign: "center" }}>
            SECURE LOGIN
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.15em", marginBottom: 6, fontWeight: 600 }}>
              USERNAME
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{
                width: "100%", padding: "10px 14px",
                background: "rgba(2,6,20,0.75)",
                border: "1px solid hsl(220 40% 30%)",
                borderRadius: 6,
                color: "hsl(185 100% 75%)",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "hsl(185 100% 55%)"}
              onBlur={e => e.target.style.borderColor = "hsl(220 40% 30%)"}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, color: "hsl(185 80% 64%)", letterSpacing: "0.15em", marginBottom: 6, fontWeight: 600 }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{
                width: "100%", padding: "10px 14px",
                background: "rgba(2,6,20,0.75)",
                border: "1px solid hsl(220 40% 30%)",
                borderRadius: 6,
                color: "hsl(185 100% 75%)",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "hsl(185 100% 55%)"}
              onBlur={e => e.target.style.borderColor = "hsl(220 40% 30%)"}
            />
          </div>

          {error && (
            <div style={{ padding: "8px 12px", background: "hsl(0 100% 60% / 0.1)", border: "1px solid hsl(0 100% 60% / 0.3)", borderRadius: 6, fontSize: 12, color: "hsl(0 100% 68%)", marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "12px",
              background: loading ? "hsl(222 35% 16%)" : "linear-gradient(135deg, hsl(195 100% 35%), hsl(195 100% 25%))",
              border: "1px solid hsl(195 100% 50% / 0.5)",
              borderRadius: 6,
              color: loading ? "hsl(185 80% 64%)" : "hsl(195 100% 90%)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.2em",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 0 20px hsl(195 100% 50% / 0.3)",
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
          >
            {loading ? "AUTHENTICATING..." : "LOGIN TO SYSTEM"}
          </button>

          <div style={{ marginTop: 16, padding: "8px 12px", background: "rgba(2,6,20,0.75)", borderRadius: 6, border: "1px solid hsl(220 40% 24%)" }}>
            <div style={{ fontSize: 9, color: "hsl(220 25% 56%)", letterSpacing: "0.1em", marginBottom: 4 }}>DEMO CREDENTIALS</div>
            <div style={{ fontSize: 11, color: "hsl(185 80% 68%)", fontFamily: "monospace" }}>
              admin / admin123
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 9, color: "hsl(220 25% 45%)", marginTop: 16, letterSpacing: "0.1em" }}>
          AI ADAPTIVE TRAFFIC SIGNAL MANAGEMENT SYSTEM · FYP PROJECT 2027
        </p>
      </div>
    </div>
  );
}
