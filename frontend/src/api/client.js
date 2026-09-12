// Single place where the API base URL lives. Change it once, not in twelve files.
const BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Long enough for a forecast run, short enough that a dead connection surfaces.
const TIMEOUT_MS = 45000;

async function request(path, options = {}) {
  const { headers, timeoutMs = TIMEOUT_MS, ...rest } = options;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      ...rest,
    });
  } catch (cause) {
    // A request that never reached the server, or never came back. The caller
    // needs to tell these apart from a refusal, so they get status 0.
    const timedOut = cause?.name === "TimeoutError" || cause?.name === "AbortError";
    throw new ApiError(0, timedOut
      ? "The server took too long to answer. It may still be working — check before trying again."
      : "Can't reach the server. Check that the API is running, then try again.");
  }
  const body = await res.json().catch(() => null);
  // A session that expires mid-use sends the whole app back to the login screen.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event("gridsense:unauthorized"));
  }
  // The server's own message is the specific one, so it wins. These are for
  // the cases where it cannot answer in words.
  if (!res.ok) throw new ApiError(res.status, body?.error ?? statusMessage(res.status));
  return body;
}

function statusMessage(status) {
  if (status === 401) return "Your session has expired. Sign in again and your work is still here.";
  if (status === 403) return "This account isn't allowed to do that.";
  if (status === 404) return "That isn't there any more.";
  if (status === 409) return "Something changed while you were working. Reload and try again.";
  if (status === 429) return "That was a lot of requests at once. Wait a few seconds and try again.";
  if (status === 502 || status === 503 || status === 504) return "The server is not answering right now.";
  if (status >= 500) return "The server hit a problem handling that.";
  return "That request didn't go through.";
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
  // `idempotencyKey` makes a retry safe: the server returns the plant the
  // first attempt created instead of making a second one.
  createPlant: (plant, idempotencyKey) => request("/api/plants", {
    ...post(plant),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  }),
  currentWeather: (latitude, longitude) =>
    request(`/api/weather/current?latitude=${latitude}&longitude=${longitude}`, { timeoutMs: 12000 }),
  updatePlant: (id, changes) =>
    request(`/api/plants/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  modelCard: () => request("/api/model"),
  settings: () => request("/api/settings"),
  generation: (id, limit = 500) => request(`/api/plants/${id}/generation?limit=${limit}`),
  forecast: (id, horizon = 24) => request(`/api/plants/${id}/forecast?horizon=${horizon}`),
  recommendations: (id) => request(`/api/plants/${id}/recommendations`),
  runForecast: (plantId) => request("/api/forecast/run", post({ plant_id: plantId })),
  declareSchedule: (plantId) => request(`/api/plants/${plantId}/schedule`, { method: "POST" }),
  runDiagnostic: (plantId) => request("/api/diagnostics/run", post({ plant_id: plantId })),
  alerts: (status) => request(status ? `/api/alerts?status=${status}` : "/api/alerts"),
  updateAlert: (id, status) =>
    request(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  costingPreview: (body) => request("/api/costing/preview", post(body)),
};
