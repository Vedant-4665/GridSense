// Single place where the API base URL lives. Change it once, not in twelve files.
const BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => null);
  // A session that expires mid-use sends the whole app back to the login screen.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event("gridsense:unauthorized"));
  }
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`);
  return body;
}

const post = (body) => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () => request("/api/health"),

  me: () => request("/api/auth/me"),
  login: (email, password) => request("/api/auth/login", post({ email, password })),
  register: (account) => request("/api/auth/register", post(account)),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  demo: (role) => request("/api/auth/demo", post({ role })),

  summary: () => request("/api/dashboard/summary"),
  plants: () => request("/api/plants"),
  plant: (id) => request(`/api/plants/${id}`),
  createPlant: (plant) => request("/api/plants", post(plant)),
  generation: (id, limit = 500) => request(`/api/plants/${id}/generation?limit=${limit}`),
  forecast: (id, horizon = 24) => request(`/api/plants/${id}/forecast?horizon=${horizon}`),
  recommendations: (id) => request(`/api/plants/${id}/recommendations`),
  runForecast: (plantId) => request("/api/forecast/run", post({ plant_id: plantId })),
  alerts: (status) => request(status ? `/api/alerts?status=${status}` : "/api/alerts"),
  updateAlert: (id, status) =>
    request(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  costingPreview: (body) => request("/api/costing/preview", post(body)),
};
