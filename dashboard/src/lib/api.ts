const BASE = "/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("agri_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export interface SensorReading {
  node: string;
  air_temp_c: number | null;
  pressure_hpa: number | null;
  soil_temp_c: number | null;
  soil_moisture_pct: number | null;
  tank_level_pct: number | null;
  pump_on: boolean;
  auto_mode: boolean;
  timestamp: string;
}

export interface HistoryPoint {
  timestamp: string;
  value: number | null;
}

export interface IrrigationStat {
  date: string;
  pump_runtime_minutes: number;
  water_used_liters: number;
  irrigation_cycles: number;
}

export interface TwinPlant {
  id: string;
  x: number;
  y: number;
  species: string;
  health: "healthy" | "stressed";
}

export interface TwinState {
  pump_on: boolean;
  tank_level_pct: number;
  soil_moisture_pct: number;
  flow_active: boolean;
  plants: TwinPlant[];
}

export interface DetectionBox {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface DetectionResult {
  timestamp: string;
  image_url: string | null;
  detections: DetectionBox[];
  healthy_count: number;
  diseased_count: number;
}

export const api = {
  listNodes: () => request<string[]>("/sensors/nodes"),
  getLatest: (node: string) => request<SensorReading>(`/sensors/${node}/latest`),
  getHistory: (node: string, field: string, hours = 24) =>
    request<{ points: HistoryPoint[] }>(`/sensors/${node}/history?field=${field}&hours=${hours}`),

  setPump: (node: string, on: boolean) =>
    request(`/control/${node}/pump`, { method: "POST", body: JSON.stringify({ on }) }),
  setMode: (node: string, auto: boolean) =>
    request(`/control/${node}/mode`, { method: "POST", body: JSON.stringify({ auto }) }),
  setThresholds: (node: string, low_pct: number, high_pct: number) =>
    request(`/control/${node}/thresholds`, {
      method: "POST",
      body: JSON.stringify({ low_pct, high_pct }),
    }),
  getControlStatus: (node: string) => request(`/control/${node}/status`),

  getIrrigationStats: (node: string, days = 7) =>
    request<{ stats: IrrigationStat[] }>(`/analytics/${node}/irrigation-stats?days=${days}`),
  getSummary: (node: string) => request(`/analytics/${node}/summary`),

  getTwinState: (node: string) => request<TwinState>(`/twin/${node}/state`),

  detectDisease: async (node: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`${BASE}/ai/detect`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error(`AI detect failed: ${res.status}`);
    return res.json() as Promise<DetectionResult>;
  },
  getAiStatus: () => request("/ai/status"),

  login: async (username: string, password: string) => {
    const body = new URLSearchParams({ username, password });
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    localStorage.setItem("agri_token", data.access_token);
    return data;
  },
  logout: () => localStorage.removeItem("agri_token"),
  isAuthenticated: () => !!localStorage.getItem("agri_token"),
};
