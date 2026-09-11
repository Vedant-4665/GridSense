// Single place where the API base URL lives. Change it once, not in twelve files.
const BASE = import.meta.env.VITE_API_BASE ?? "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json();
}

export const api = {
  health: () => request("/api/health"),
  summary: () => request("/api/dashboard/summary"),
  plants: () => request("/api/plants"),
  plant: (id) => request(`/api/plants/${id}`),
  generation: (id, limit = 500) => request(`/api/plants/${id}/generation?limit=${limit}`),
  forecast: (id, horizon = 24) => request(`/api/plants/${id}/forecast?horizon=${horizon}`),
  recommendations: (id) => request(`/api/plants/${id}/recommendations`),
  alerts: (status = "open") => request(`/api/alerts?status=${status}`),
  updateAlert: (id, status) =>
    request(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  costingPreview: (body) =>
    request("/api/costing/preview", { method: "POST", body: JSON.stringify(body) }),
};
