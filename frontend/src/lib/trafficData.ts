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

const laneNames = ["Main St North", "Broadway East", "Main St South", "Broadway West"];

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
  const baseVehicles = 800 + Math.floor(Math.sin(tick * 0.05) * 300) + randomBetween(-50, 50);
  const inbound = Math.floor(baseVehicles * 0.55) + randomBetween(-20, 20);
  const outbound = baseVehicles - inbound;

  const lanes: Lane[] = laneNames.map((name, i) => {
    const signal = getSignalForLane(i, tick);
    const count = randomBetween(80, 350);
    const density = Math.min(100, Math.floor((count / 350) * 100));
    const timeRem = signal === "GREEN" ? randomBetween(10, 60)
      : signal === "YELLOW" ? randomBetween(3, 8)
      : randomBetween(15, 90);
    const wait = signal === "RED" ? randomBetween(15, 120) : randomBetween(0, 30);
    return { id: `lane-${i}`, name, signal, timeRemaining: timeRem, vehicleCount: count, density, waitTime: wait };
  });

  const decisions = [
    "Optimizing North corridor — high density detected",
    "Extending green phase for Main St North (peak flow)",
    "Switching to Plan B — congestion on Broadway East",
    "AI predicted surge in 2h — pre-adjusting cycles",
    "AI model: redistributing signal timing across 4 lanes",
    "Emergency vehicle priority activated — Main St North",
  ];

  const plans = ["PLAN A (Peak Hour)", "PLAN B (Off-Peak)", "PLAN C (Night)", "PLAN D (Emergency)"];

  const greenLane = lanes.find(l => l.signal === "GREEN");
  const nextLane = lanes.find(l => l.signal === "RED");

  if (tick % 15 === 0) {
    const lane = lanes[randomBetween(0, 3)];
    logStore.unshift({
      id: logId++,
      time: new Date().toLocaleTimeString(),
      lane: lane.name,
      vehicles: lane.vehicleCount,
      density: lane.density > 70 ? "HIGH" : lane.density > 40 ? "MEDIUM" : "LOW",
      signal: lane.signal,
      greenTime: randomBetween(20, 60),
      aiAction: decisions[randomBetween(0, decisions.length - 1)],
    });
    if (logStore.length > 100) logStore.pop();
  }

  return {
    timestamp: Date.now(),
    totalVehicles: baseVehicles,
    inboundFlow: inbound,
    outboundFlow: outbound,
    lanes,
    aiDecision: decisions[randomBetween(0, decisions.length - 1)],
    currentPlan: plans[Math.floor(tick / 50) % plans.length],
    adaptiveMode: true,
    nextPhase: nextLane ? `${nextLane.name} GREEN (${randomBetween(15, 40)}s)` : "Calculating...",
  };
}

export function getLogs(): LogEntry[] {
  if (logStore.length === 0) {
    for (let i = 0; i < 20; i++) {
      const lane = laneNames[randomBetween(0, 3)];
      const sig: SignalState = ["RED", "GREEN", "YELLOW"][randomBetween(0, 2)] as SignalState;
      logStore.push({
        id: logId++,
        time: new Date(Date.now() - i * 60000).toLocaleTimeString(),
        lane,
        vehicles: randomBetween(50, 400),
        density: ["HIGH", "MEDIUM", "LOW"][randomBetween(0, 2)],
        signal: sig,
        greenTime: randomBetween(20, 60),
        aiAction: "Adaptive phase adjustment",
      });
    }
  }
  return logStore;
}

export function getHistoricalData() {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const basePattern = [200, 180, 150, 140, 160, 250, 450, 680, 820, 750, 700, 720,
    780, 740, 710, 730, 800, 900, 850, 760, 650, 500, 380, 280];
  return hours.map(h => ({
    hour: `${h}:00`,
    vehicles: basePattern[h] + randomBetween(-30, 30),
    predicted: basePattern[h] + randomBetween(-10, 60),
    north: Math.floor(basePattern[h] * 0.35) + randomBetween(-20, 20),
    east: Math.floor(basePattern[h] * 0.28) + randomBetween(-20, 20),
    south: Math.floor(basePattern[h] * 0.22) + randomBetween(-20, 20),
    west: Math.floor(basePattern[h] * 0.15) + randomBetween(-20, 20),
  }));
}

export function getPredictionData() {
  const now = Date.now();
  return Array.from({ length: 8 }, (_, i) => ({
    label: i === 0 ? "Now" : `+${i}h`,
    predicted: 800 + i * 80 + randomBetween(-30, 30),
    upper: 900 + i * 100 + randomBetween(0, 50),
    lower: 700 + i * 60 + randomBetween(-30, 0),
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
      { feature: "Vehicle Count", importance: 0.32 },
      { feature: "Time of Day", importance: 0.24 },
      { feature: "Density Pattern", importance: 0.18 },
      { feature: "Weather", importance: 0.12 },
      { feature: "Historical Flow", importance: 0.09 },
      { feature: "Emergency Alerts", importance: 0.05 },
    ],
    hourlyAccuracy: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      accuracy: 90 + randomBetween(0, 8),
    })),
  };
}
