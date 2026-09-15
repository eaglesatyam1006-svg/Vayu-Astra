const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, { method = "GET", apiKey, body } = {}) {
  const headers = {};
  if (apiKey) headers["X-API-Key"] = apiKey;
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {
      /* ignore parse failure, use statusText */
    }
    const err = new Error(`${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  health: () => request("/v1/health"),
  sources: () => request("/v1/sources"),
  routes: () => request("/v1/routes"),
  routeDetail: (origin, destination) => request(`/v1/routes/${origin}-${destination}`),
  index: () => request("/v1/index"),
  anomalies: (threshold = 2.0) => request(`/v1/anomalies?threshold=${threshold}`),
  forecast: (origin, destination, horizon = 30) =>
    request(`/v1/forecast/${origin}-${destination}?horizon_days=${horizon}`),
  forecastMl: (origin, destination, horizon = 30) =>
    request(`/v1/forecast/ml/${origin}-${destination}?horizon_days=${horizon}`),
  anomaliesMl: (contamination = 0.07) => request(`/v1/anomalies/ml?contamination=${contamination}`),
  assistantQuery: (query, history) =>
    request(`/v1/assistant/query`, { method: "POST", body: { query, history } }),
  assistantStatus: () => request(`/v1/assistant/status`),
  cpiImpact: () => request("/v1/cpi/impact"),
  geoRoutes: () => request("/v1/geo/routes"),
  endpoints: () => request("/v1/meta/endpoints"),
  createApiKey: (name, tier) =>
    request(`/v1/auth/keys?name=${encodeURIComponent(name)}&tier=${tier}`, { method: "POST" }),
  systemMetrics: (apiKey) => request("/v1/system/metrics", { apiKey }),
  listApiKeys: (apiKey) => request("/v1/auth/keys", { apiKey }),
};