// ─── Backend API Connection ───────────────────────────────────
// All frontend → backend communication goes through this file

const BASE = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

// ─── Types ────────────────────────────────────────────────────

export interface SignalStates {
  north: "green" | "yellow" | "red";
  south: "green" | "yellow" | "red";
  east:  "green" | "yellow" | "red";
  west:  "green" | "yellow" | "red";
}

export interface SignalStatus {
  states:      SignalStates;
  green_lane:  string;
  is_manual:   boolean;
  phase_index: number;
}

export interface PredictionResult {
  lane:                  string;
  predicted_green_time:  number;
  final_category:        string;
  vote_agreement:        string;
  votes:                 string[];
  model_used:            string;
  prediction_id?:        number;
  input:                 {
    vehicle_count: number;
    queue_length:  number;
    avg_speed:     number;
    density:       number;
  };
}

export interface TrafficLog {
  id:            number;
  timestamp:     string;
  lane:          string;
  vehicle_count: number;
  queue_length:  number;
  avg_speed:     number;
  density:       number;
}

export interface SignalEvent {
  id:           number;
  timestamp:    string;
  lane:         string;
  signal_state: string;
  duration:     number;
  is_manual:    boolean;
}

export interface PredictionLog {
  id:                   number;
  timestamp:            string;
  lane:                 string;
  predicted_green_time: number;
  actual_green_time:    number | null;
  model_used:           string;
}

export interface LogsSummary {
  total_traffic_logs:    number;
  total_signal_events:   number;
  total_predictions:     number;
  manual_overrides:      number;
  predictions_evaluated: number;
  avg_prediction_error:  string;
  lanes:                 string[];
}

export interface PredictionStats {
  [lane: string]: {
    count: number;
    avg:   number;
    max:   number;
    min:   number;
  };
}

export interface SignalStats {
  [lane: string]: {
    total_cycles:     number;
    avg_green_time:   number;
    manual_overrides: number;
  };
}

export interface WebSocketMessage {
  type:           string;
  timestamp:      number;
  states:         SignalStates;
  green_lane:     string;
  is_manual:      boolean;
  time_remaining: number;
}

// ─── Helper ───────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Signals API ──────────────────────────────────────────────

export const signalsApi = {
  getStates: () =>
    apiFetch<SignalStates>("/signals/states"),

  getStatus: () =>
    apiFetch<SignalStatus>("/signals/"),

  getHistory: () =>
    apiFetch<SignalEvent[]>("/signals/history"),

  getStats: () =>
    apiFetch<SignalStats>("/signals/stats"),

  nextPhase: (counts: Record<string, number>) => {
    const params = new URLSearchParams(
      Object.entries(counts).map(([k, v]) => [k, String(v)])
    );
    return apiFetch<SignalStatus>(`/signals/next?${params}`, { method: "POST" });
  },
};

// ─── Predictions API ──────────────────────────────────────────

export const predictionsApi = {
  predict: (
    lane: string,
    vehicle_count: number,
    queue_length = 2,
    avg_speed = 20,
    density = 0.5
  ) => {
    const params = new URLSearchParams({
      lane,
      vehicle_count: String(vehicle_count),
      queue_length:  String(queue_length),
      avg_speed:     String(avg_speed),
      density:       String(density),
    });
    return apiFetch<PredictionResult>(`/predictions/predict?${params}`, { method: "POST" });
  },

  predictAll: (counts: Record<string, number>) => {
    const params = new URLSearchParams({
      north_count: String(counts.north ?? 5),
      south_count: String(counts.south ?? 5),
      east_count:  String(counts.east  ?? 5),
      west_count:  String(counts.west  ?? 5),
    });
    return apiFetch<Record<string, PredictionResult>>(
      `/predictions/predict/all?${params}`,
      { method: "POST" }
    );
  },

  getAll: () =>
    apiFetch<PredictionLog[]>("/predictions/"),

  getStats: () =>
    apiFetch<PredictionStats>("/predictions/stats"),

  getLaneHistory: (lane: string) =>
    apiFetch<PredictionLog[]>(`/predictions/history/${lane}`),

  updateActual: (id: number, actual_time: number) => {
    const params = new URLSearchParams({ actual_time: String(actual_time) });
    return apiFetch(`/predictions/update_actual/${id}?${params}`, { method: "POST" });
  },
};

// ─── Control API ──────────────────────────────────────────────

export const controlApi = {
  getStatus: () =>
    apiFetch("/control/status"),

  manualOverride: (lane: string, green_time = 30) => {
    const params = new URLSearchParams({ green_time: String(green_time) });
    return apiFetch(`/control/manual/${lane}?${params}`, { method: "POST" });
  },

  release: () =>
    apiFetch("/control/release", { method: "POST" }),

  emergency: () =>
    apiFetch("/control/emergency", { method: "POST" }),

  startTimer: (counts: Record<string, number>) => {
    const params = new URLSearchParams({
      north: String(counts.north ?? 5),
      south: String(counts.south ?? 5),
      east:  String(counts.east  ?? 5),
      west:  String(counts.west  ?? 5),
    });
    return apiFetch(`/control/timer/start?${params}`, { method: "POST" });
  },

  stopTimer: () =>
    apiFetch("/control/timer/stop", { method: "POST" }),
};

// ─── Logs API ─────────────────────────────────────────────────

export const logsApi = {
  getTrafficLogs: (limit = 100, lane?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (lane) params.append("lane", lane);
    return apiFetch<TrafficLog[]>(`/logs/?${params}`);
  },

  getSignalLogs: (limit = 100, lane?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (lane) params.append("lane", lane);
    return apiFetch<SignalEvent[]>(`/logs/signals?${params}`);
  },

  getPredictionLogs: (limit = 100, lane?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (lane) params.append("lane", lane);
    return apiFetch<PredictionLog[]>(`/logs/predictions?${params}`);
  },

  getSummary: () =>
    apiFetch<LogsSummary>("/logs/summary"),
};

// ─── WebSocket ────────────────────────────────────────────────

export function createWebSocket(
  onMessage: (data: WebSocketMessage) => void,
  onError?: (e: Event) => void
): WebSocket {
  const ws = new WebSocket(WS_URL);

  ws.onmessage = (event) => {
    try {
      const data: WebSocketMessage = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error("WS parse error:", e);
    }
  };

  ws.onerror = (e) => {
    console.error("WebSocket error:", e);
    onError?.(e);
  };

  ws.onclose = () => {
    console.log("WebSocket closed");
  };

  return ws;
}

// ─── Lane name mapping ────────────────────────────────────────
// Backend uses: north, south, east, west
// Frontend displays: Main St North, Broadway East, etc.

export const LANE_DISPLAY: Record<string, string> = {
  north: "Main St North",
  south: "Main St South",
  east:  "Broadway East",
  west:  "Broadway West",
};

export const LANE_KEYS = ["north", "south", "east", "west"];

// Convert backend signal state to frontend SignalState
export function toSignalState(state: string): "RED" | "GREEN" | "YELLOW" {
  return state.toUpperCase() as "RED" | "GREEN" | "YELLOW";
}
