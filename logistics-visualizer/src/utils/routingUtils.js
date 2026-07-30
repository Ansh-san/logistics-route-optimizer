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
 * Also computes total durationMin from the enriched edge list (optional).
 *
 * @param {Array<{id: string}>} nodes
 * @param {Array} edges - graph edges (used for adjacency)
 * @param {string} startId
 * @param {string} endId
 * @param {Array} [enrichedEdges] - optional live edges with durationMin; if omitted durationMin is null
 * @returns {{ path: string[], distance: number, durationMin: number|null } | null}
 */
export function findShortestPath(nodes, edges, startId, endId, enrichedEdges) {
  if (startId === endId) return { path: [startId], distance: 0, durationMin: 0 };

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

  // Compute total durationMin from enriched edges (if provided)
  let durationMin = null;
  if (enrichedEdges && path.length >= 2) {
    let total = 0;
    let allKnown = true;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const edge = enrichedEdges.find(
        (e) => (e.source === a && e.target === b) || (e.target === a && e.source === b)
      );
      if (!edge || edge.durationMin == null) {
        allKnown = false;
        break;
      }
      total += edge.durationMin;
    }
    if (allKnown) durationMin = total;
  }

  return { path, distance: distances[endId], durationMin };
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

// ----- Yen's k-shortest loopless paths -----

/**
 * Yen's algorithm — finds the k shortest loopless paths between two nodes.
 * Builds on the existing findShortestPath (Dijkstra) as its subroutine.
 *
 * @param {Array<{id: string}>} nodes
 * @param {Array<{source: string, target: string, distance: number}>} edges
 * @param {string} startId
 * @param {string} endId
 * @param {number} k - number of paths to find (e.g. 2)
 * @returns {Array<{path: string[], distance: number}>} sorted by distance ascending,
 *          length may be less than k if fewer distinct paths exist
 */
export function findKShortestPaths(nodes, edges, startId, endId, k) {
  const firstPath = findShortestPath(nodes, edges, startId, endId);
  if (!firstPath) return [];

  const A = [firstPath]; // finalized shortest paths, in order
  const B = [];          // candidate paths, sorted by distance when picked

  for (let ki = 1; ki < k; ki++) {
    const prevPath = A[ki - 1].path;

    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1);

      // Remove edges that would recreate already-found paths sharing this root
      const edgesToRemove = new Set();
      for (const foundPath of A) {
        if (
          foundPath.path.length > i &&
          JSON.stringify(foundPath.path.slice(0, i + 1)) === JSON.stringify(rootPath)
        ) {
          edgesToRemove.add(`${foundPath.path[i]}|${foundPath.path[i + 1]}`);
        }
      }

      // Remove root path nodes (except spur node) from consideration to keep paths loopless
      const nodesToRemove = new Set(rootPath.slice(0, -1));

      const filteredEdges = edges.filter((e) => {
        const key1 = `${e.source}|${e.target}`;
        const key2 = `${e.target}|${e.source}`;
        if (edgesToRemove.has(key1) || edgesToRemove.has(key2)) return false;
        if (nodesToRemove.has(e.source) || nodesToRemove.has(e.target)) return false;
        return true;
      });

      const spurPathResult = findShortestPath(nodes, filteredEdges, spurNode, endId);
      if (!spurPathResult) continue;

      const rootDistance = rootPath.slice(0, -1).reduce((sum, nodeId, idx) => {
        const nextNode = rootPath[idx + 1];
        const edge = edges.find(
          (e) =>
            (e.source === nodeId && e.target === nextNode) ||
            (e.target === nodeId && e.source === nextNode)
        );
        return sum + (edge ? edge.distance : 0);
      }, 0);

      const totalPath = [...rootPath.slice(0, -1), ...spurPathResult.path];
      const totalDistance = rootDistance + spurPathResult.distance;

      const alreadyExists =
        A.some((p) => JSON.stringify(p.path) === JSON.stringify(totalPath)) ||
        B.some((p) => JSON.stringify(p.path) === JSON.stringify(totalPath));

      if (!alreadyExists) {
        B.push({ path: totalPath, distance: totalDistance });
      }
    }

    if (B.length === 0) break;

    B.sort((a, b) => a.distance - b.distance);
    A.push(B.shift());
  }

  return A;
}