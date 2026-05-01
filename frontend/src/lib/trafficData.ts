// ─── Real Backend Data ────────────────────────────────────────
// This file now fetches REAL data from FastAPI backend
// Fallback to mock data if backend is not running

export type SignalState = "RED" | "GREEN" | "YELLOW";

export interface Lane {
  id: string;
  name: string;
  signal: SignalState;
  timeRemaining: number;
  vehicleCount: number;
  density: number;
  waitTime: number;
}

export interface TrafficSnapshot {
  timestamp: number;
  totalVehicles: number;
  inboundFlow: number;
  outboundFlow: number;
  lanes: Lane[];
  aiDecision: string;
  currentPlan: string;
  adaptiveMode: boolean;
  nextPhase: string;
}

export interface LogEntry {
  id: number;
  time: string;
  lane: string;
  vehicles: number;
  density: string;
  signal: SignalState;
  greenTime: number;
  aiAction: string;
}

// ─── Lane display names ───────────────────────────────────────
const LANE_NAMES: Record<string, string> = {
  north: "Main St North",
  south: "Main St South",
  east:  "Broadway East",
  west:  "Broadway West",
};

const LANE_KEYS = ["north", "south", "east", "west"];

// ─── Mock fallback (if backend offline) ──────────────────────
let tick = 0;
let logId = 1;
const logStore: LogEntry[] = [];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSignalForLane(index: number, t: number): SignalState {
  const cycle = Math.floor(t / 10) % 4;
  if (cycle === index) return "GREEN";
  if (cycle === (index + 3) % 4) return "YELLOW";
  return "RED";
}

export function generateSnapshot(): TrafficSnapshot {
  tick++;
  const baseVehicles =
    800 + Math.floor(Math.sin(tick * 0.05) * 300) + randomBetween(-50, 50);
  const inbound  = Math.floor(baseVehicles * 0.55) + randomBetween(-20, 20);
  const outbound = baseVehicles - inbound;

  const lanes: Lane[] = LANE_KEYS.map((key, i) => {
    const signal    = getSignalForLane(i, tick);
    const count     = randomBetween(80, 350);
    const density   = Math.min(100, Math.floor((count / 350) * 100));
    const timeRem   =
      signal === "GREEN"  ? randomBetween(10, 60) :
      signal === "YELLOW" ? randomBetween(3, 8)   :
                            randomBetween(15, 90);
    const wait = signal === "RED" ? randomBetween(15, 120) : randomBetween(0, 30);
    return {
      id: `lane-${i}`,
      name: LANE_NAMES[key],
      signal, timeRemaining: timeRem,
      vehicleCount: count, density, waitTime: wait,
    };
  });

  const decisions = [
    "Optimizing North corridor — high density detected",
    "Extending green phase for Main St North (peak flow)",
    "Switching to Plan B — congestion on Broadway East",
    "AI predicted surge in 2h — pre-adjusting cycles",
    "AI model: redistributing signal timing across 4 lanes",
  ];
  const plans = ["PLAN A (Peak Hour)", "PLAN B (Off-Peak)", "PLAN C (Night)"];
  const nextLane = lanes.find(l => l.signal === "RED");

  return {
    timestamp: Date.now(),
    totalVehicles: baseVehicles,
    inboundFlow: inbound,
    outboundFlow: outbound,
    lanes,
    aiDecision: decisions[randomBetween(0, decisions.length - 1)],
    currentPlan: plans[Math.floor(tick / 50) % plans.length],
    adaptiveMode: true,
    nextPhase: nextLane
      ? `${nextLane.name} GREEN (${randomBetween(15, 40)}s)`
      : "Calculating...",
  };
}

// ─── REAL API: Fetch signal states from backend ───────────────
export async function fetchSignalStates(): Promise<Record<string, SignalState>> {
  try {
    const res = await fetch("http://localhost:8000/signals/states");
    if (!res.ok) throw new Error("Backend offline");
    const data = await res.json();
    // Convert lowercase to uppercase
    const states: Record<string, SignalState> = {};
    for (const [lane, state] of Object.entries(data)) {
      states[lane] = (state as string).toUpperCase() as SignalState;
    }
    return states;
  } catch {
    // Fallback: mock states
    return { north: "GREEN", south: "RED", east: "RED", west: "RED" };
  }
}

// ─── REAL API: Fetch prediction for a lane ───────────────────
export async function fetchPrediction(
  lane: string,
  vehicleCount: number,
  queueLength = 2,
  density = 0.5,
  congestionRatio = 0.4,
  countChange = 1
) {
  try {
    const params = new URLSearchParams({
      lane,
      vehicle_count:    String(vehicleCount),
      queue_length:     String(queueLength),
      density:          String(density),
      congestion_ratio: String(congestionRatio),
      count_change:     String(countChange),
    });
    const res = await fetch(
      `http://localhost:8000/predictions/predict?${params}`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error("Prediction failed");
    return await res.json();
  } catch {
    return {
      lane,
      predicted_green_time: 30,
      traffic_category: "MEDIUM",
      gru_green: 28,
      classifier_green: 32,
      classifier_confidence: 85,
      model_used: "fallback",
    };
  }
}

// ─── REAL API: Fetch all predictions ─────────────────────────
export async function fetchAllPredictions(counts: Record<string, number>) {
  try {
    const params = new URLSearchParams({
      north_count: String(counts.north ?? 5),
      south_count: String(counts.south ?? 5),
      east_count:  String(counts.east  ?? 5),
      west_count:  String(counts.west  ?? 5),
    });
    const res = await fetch(
      `http://localhost:8000/predictions/predict/all?${params}`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return null;
  }
}

// ─── REAL API: Fetch logs ─────────────────────────────────────
export async function fetchLogs(limit = 50) {
  try {
    const res = await fetch(`http://localhost:8000/logs/?limit=${limit}`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return [];
  }
}

// ─── REAL API: Manual override ───────────────────────────────
export async function sendManualOverride(lane: string, greenTime = 30) {
  try {
    const params = new URLSearchParams({ green_time: String(greenTime) });
    const res = await fetch(
      `http://localhost:8000/control/manual/${lane}?${params}`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error("Override failed");
    return await res.json();
  } catch (e) {
    console.error("Manual override error:", e);
    return null;
  }
}

// ─── Keep mock helpers for pages that still use them ─────────
export function getLogs(): LogEntry[] {
  if (logStore.length === 0) {
    for (let i = 0; i < 20; i++) {
      const key  = LANE_KEYS[randomBetween(0, 3)];
      const sig: SignalState = (["RED","GREEN","YELLOW"] as SignalState[])[randomBetween(0,2)];
      logStore.push({
        id:       logId++,
        time:     new Date(Date.now() - i * 60000).toLocaleTimeString(),
        lane:     LANE_NAMES[key],
        vehicles: randomBetween(50, 400),
        density:  ["HIGH","MEDIUM","LOW"][randomBetween(0,2)],
        signal:   sig,
        greenTime: randomBetween(20, 60),
        aiAction: "Adaptive phase adjustment",
      });
    }
  }
  return logStore;
}

export function getHistoricalData() {
  const base = [200,180,150,140,160,250,450,680,820,750,700,720,
                780,740,710,730,800,900,850,760,650,500,380,280];
  return base.map((v, h) => ({
    hour: `${h}:00`,
    vehicles:  v + randomBetween(-30, 30),
    predicted: v + randomBetween(-10, 60),
    north: Math.floor(v * 0.35) + randomBetween(-20, 20),
    east:  Math.floor(v * 0.28) + randomBetween(-20, 20),
    south: Math.floor(v * 0.22) + randomBetween(-20, 20),
    west:  Math.floor(v * 0.15) + randomBetween(-20, 20),
  }));
}

export function getPredictionData() {
  return Array.from({ length: 8 }, (_, i) => ({
    label: i === 0 ? "Now" : `+${i}h`,
    predicted: 800 + i * 80 + randomBetween(-30, 30),
    upper:     900 + i * 100 + randomBetween(0, 50),
    lower:     700 + i * 60  + randomBetween(-30, 0),
  }));
}

export function getAIMetrics() {
  return {
    accuracy: 94.7,
    falsePositives: 2.1,
    avgGreenOptimization: 23,
    totalOptimizations: 1847,
    congestionReduced: 34,
    avgWaitReduction: 28,
    modelStatus: "ACTIVE",
    lastTrained: "2h ago",
    featureImportance: [
      { feature: "Vehicle Count",    importance: 0.32 },
      { feature: "Queue Length",     importance: 0.24 },
      { feature: "Density Pattern",  importance: 0.18 },
      { feature: "Congestion Ratio", importance: 0.12 },
      { feature: "Count Change",     importance: 0.09 },
      { feature: "Emergency Alerts", importance: 0.05 },
    ],
    hourlyAccuracy: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      accuracy: 90 + randomBetween(0, 8),
    })),
  };
}