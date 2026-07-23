// routingUtils.js
// Pure algorithmic logic — no React, no DOM, no Leaflet imports.
// Designed to be lifted verbatim into a Node/Express controller later:
//   app.post('/api/route', (req, res) => {
//     const result = findShortestPath(nodes, edges, req.body.source, req.body.target);
//     res.json(result);
//   });

/**
 * Builds an adjacency list from a flat node/edge list.
 * @param {Array<{id: string}>} nodes
 * @param {Array<{source: string, target: string, distance: number}>} edges
 * @returns {Object} adjacency list: { nodeId: [{ node, distance }] }
 */
export function buildAdjacencyList(nodes, edges) {
  const adjacency = {};
  nodes.forEach((n) => {
    adjacency[n.id] = [];
  });

  edges.forEach(({ source, target, distance }) => {
    if (!adjacency[source] || !adjacency[target]) return; // guard bad data
    adjacency[source].push({ node: target, distance });
    adjacency[target].push({ node: source, distance }); // undirected
  });

  return adjacency;
}

/**
 * Minimal binary min-heap priority queue.
 * Overkill for 6 nodes, but this is what makes the algorithm scale
 * cleanly once your MERN backend has hundreds of warehouses.
 */
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
 *
 * @param {Array<{id: string}>} nodes
 * @param {Array<{source: string, target: string, distance: number}>} edges
 * @param {string} startId
 * @param {string} endId
 * @returns {{ path: string[], distance: number } | null}
 *          null if no path exists or inputs are invalid.
 */
export function findShortestPath(nodes, edges, startId, endId) {
  if (startId === endId) return { path: [startId], distance: 0 };

  const adjacency = buildAdjacencyList(nodes, edges);
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

    if (current === endId) break; // shortest path to target found

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

  if (distances[endId] === Infinity) return null; // unreachable

  // Reconstruct path by walking back through `previous`
  const path = [];
  let step = endId;
  while (step !== undefined) {
    path.unshift(step);
    step = previous[step];
  }

  return { path, distance: distances[endId] };
}