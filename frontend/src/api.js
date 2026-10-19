const BASE = "/api";

async function j(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  itineraries: () => fetch(`${BASE}/itineraries`).then(j),
  itinerary: (paxId) => fetch(`${BASE}/itineraries/${paxId}`).then(j),
  feed: (since = 0) => fetch(`${BASE}/feed?since=${since}`).then(j),
  notifications: () => fetch(`${BASE}/notifications`).then(j),
  auditLog: () => fetch(`${BASE}/audit-log`).then(j),
  metrics: () => fetch(`${BASE}/metrics`).then(j),
  getConstraints: (paxId) => fetch(`${BASE}/constraints/${paxId}`).then(j),
  updateConstraints: (paxId, constraints) =>
    fetch(`${BASE}/constraints/${paxId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(constraints),
    }).then(j),
  activeDisruption: (paxId) => fetch(`${BASE}/disruptions/active/${paxId}`).then(j),
  simulate: (payload) =>
    fetch(`${BASE}/disruptions/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(j),
  demoScenario: () =>
    fetch(`${BASE}/demo/scenario`, {
      method: "POST",
    }).then(j),
  demoReset: () =>
    fetch(`${BASE}/demo/reset`, {
      method: "POST",
    }).then(j),
  injectSingle: (paxId) =>
    fetch(`${BASE}/inject/single${paxId ? `?pax_id=${paxId}` : ""}`, {
      method: "POST",
    }).then(j),
  injectStorm: (count = 12) =>
    fetch(`${BASE}/inject/storm?count=${count}`, { method: "POST" }).then(j),
  approve: (auditId) =>
    fetch(`${BASE}/audit-log/${auditId}/approve`, { method: "POST" }).then(j),
  decline: (auditId) =>
    fetch(`${BASE}/audit-log/${auditId}/decline`, { method: "POST" }).then(j),
};
