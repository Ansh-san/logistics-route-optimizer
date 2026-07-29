// routingUtils.js
// Pure algorithmic logic — no React, no DOM, no Leaflet imports.
// Designed to be lifted verbatim into a Node/Express controller later.

export function buildAdjacencyList(nodes, edges) {
  const adjacency = {};
  nodes.forEach((n) => {
    adjacency[n.id] = [];
  });

  edges.forEach(({ source, target, distance }) => {
    if (!adjacency[source] || !adjacency[target]) return;
    adjacency[source].push({ node: target, distance });
    adjacency[target].push({ node: source, distance });
  });

  return adjacency;
}

let _cachedNodes = null;
let _cachedEdges = null;
let _cachedAdjacency = null;

function getAdjacencyList(nodes, edges) {
  if (_cachedAdjacency && _cachedNodes === nodes && _cachedEdges === edges) {
    return _cachedAdjacency;
  }
  _cachedAdjacency = buildAdjacencyList(nodes, edges);
  _cachedNodes = nodes;
  _cachedEdges = edges;
  return _cachedAdjacency;
}

class MinPriorityQueue {
  constructor() {
    this._heap = [];
  }
  get size() {
    return this._heap.length;
  }
  enqueue(item, priority) {
    this._heap.push({ item, priority });
    this._bubbleUp(this._heap.length - 1);
  }
  dequeue() {
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._bubbleDown(0);
    }
    return top?.item;
  }
  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this._heap[parent].priority <= this._heap[idx].priority) break;
      [this._heap[parent], this._heap[idx]] = [this._heap[idx], this._heap[parent]];
      idx = parent;
    }
  }
  _bubbleDown(idx) {
    const n = this._heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this._heap[left].priority < this._heap[smallest].priority) smallest = left;
      if (right < n && this._heap[right].priority < this._heap[smallest].priority) smallest = right;
      if (smallest === idx) break;
      [this._heap[smallest], this._heap[idx]] = [this._heap[idx], this._heap[smallest]];
      idx = smallest;
    }
  }
}

/**
 * Dijkstra's algorithm — finds the shortest path between two nodes.
 */
export function findShortestPath(nodes, edges, startId, endId) {
  if (startId === endId) return { path: [startId], distance: 0 };

  const adjacency = getAdjacencyList(nodes, edges);
  if (!adjacency[startId] || !adjacency[endId]) return null;

  const distances = {};
  const previous = {};
  const visited = new Set();

  nodes.forEach((n) => {
    distances[n.id] = Infinity;
  });
  distances[startId] = 0;

  const pq = new MinPriorityQueue();
  pq.enqueue(startId, 0);

  while (pq.size > 0) {
    const current = pq.dequeue();
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endId) break;

    const neighbors = adjacency[current] || [];
    for (const { node: neighbor, distance } of neighbors) {
      if (visited.has(neighbor)) continue;
      const candidate = distances[current] + distance;
      if (candidate < distances[neighbor]) {
        distances[neighbor] = candidate;
        previous[neighbor] = current;
        pq.enqueue(neighbor, candidate);
      }
    }
  }

  if (distances[endId] === Infinity) return null;

  const path = [];
  let step = endId;
  while (step !== undefined) {
    path.unshift(step);
    step = previous[step];
  }

  return { path, distance: distances[endId] };
}

// ---------------------------------------------------------------------
// Multi-stop route optimization (open-path TSP via brute force)
// ---------------------------------------------------------------------

/**
 * Generates all permutations of an array. Fine for small inputs (<=7-8
 * items) — this app caps at 5 stops (6 warehouses minus the start), so
 * worst case is 5! = 120 permutations, trivial to brute force.
 * For larger stop counts, swap this for a heuristic (nearest-neighbor
 * + 2-opt) rather than brute force.
 */
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

/**
 * Solves the "visit all these stops starting from startId, minimizing
 * total travel distance" problem (an open-path TSP — no return to start).
 *
 * @param {Array<{id: string}>} nodes
 * @param {Array} edges
 * @param {string} startId
 * @param {string[]} stopIds - warehouses to visit, excluding startId
 * @returns {{ order: string[], path: string[], distance: number, legs: Array } | null}
 *          order: visiting sequence including startId at index 0
 *          path: full flattened path (every intermediate hop included,
 *                so consecutive entries are always directly connected edges)
 *          legs: per-leg breakdown [{ from, to, distance, path }]
 */
export function solveMultiStopRoute(nodes, edges, startId, stopIds) {
  const uniqueStops = [...new Set(stopIds)].filter((id) => id !== startId);
  if (uniqueStops.length === 0) return null;

  // Pre-compute shortest path between every relevant pair once,
  // so permutation scoring is just cheap lookups, not repeated Dijkstra runs.
  const relevantNodes = [startId, ...uniqueStops];
  const pairCache = {};
  for (const a of relevantNodes) {
    for (const b of relevantNodes) {
      if (a === b) continue;
      const key = `${a}|${b}`;
      if (!pairCache[key]) {
        pairCache[key] = findShortestPath(nodes, edges, a, b);
      }
    }
  }

  // Any unreachable pair means no valid full route exists.
  const anyUnreachable = Object.values(pairCache).some((r) => r === null);
  if (anyUnreachable) return null;

  let best = null;

  for (const perm of permutations(uniqueStops)) {
    const sequence = [startId, ...perm];
    let total = 0;
    const legs = [];

    for (let i = 0; i < sequence.length - 1; i++) {
      const from = sequence[i];
      const to = sequence[i + 1];
      const leg = pairCache[`${from}|${to}`];
      total += leg.distance;
      legs.push({ from, to, distance: leg.distance, path: leg.path });
    }

    if (!best || total < best.distance) {
      best = { order: sequence, distance: total, legs };
    }
  }

  // Flatten legs into one continuous path, without duplicating the
  // junction node shared between consecutive legs.
  const fullPath = [best.legs[0].path[0]];
  for (const leg of best.legs) {
    fullPath.push(...leg.path.slice(1));
  }

  return { order: best.order, path: fullPath, distance: best.distance, legs: best.legs };
}