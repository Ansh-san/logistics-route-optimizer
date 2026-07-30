// api.js — Frontend service layer for the Express backend.
// All routing computation is now done server-side; the frontend
// just fetches the graph and requests route solutions.

const API_BASE = "/api"; // Proxied to Express by Vite dev server

/**
 * Fetches the full warehouse graph (nodes + edges) from the API.
 * @returns {Promise<{ warehouses: Array, edges: Array }>}
 */
export async function fetchGraph() {
  const res = await fetch(`${API_BASE}/warehouses/graph`);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  return res.json();
}

/**
 * Asks the server to compute the shortest path between two warehouses.
 * @param {string} source
 * @param {string} destination
 * @returns {Promise<{ path: string[], distance: number }>}
 */
export async function calculateShortest(source, destination) {
  const res = await fetch(`${API_BASE}/routes/shortest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Shortest route failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Asks the server to solve the multi-stop TSP.
 * @param {string} startId
 * @param {string[]} stopIds
 * @returns {Promise<{ order: string[], path: string[], distance: number, legs: Array }>}
 */
export async function calculateMultiStop(startId, stopIds) {
  const res = await fetch(`${API_BASE}/routes/multi-stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startId, stopIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Multi-stop route failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Asks the server to compute the top-2 shortest paths (Yen's algorithm).
 * @param {string} source
 * @param {string} destination
 * @returns {Promise<{ routes: Array<{ path: string[], distance: number }> }>}
 */
export async function compareRoutes(source, destination) {
  const res = await fetch(`${API_BASE}/routes/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Compare routes failed: ${res.status}`);
  }
  return res.json();
}

