import Warehouse from "../models/Warehouse.js";
import Edge from "../models/Edge.js";
import { findShortestPath, solveMultiStopRoute, findKShortestPaths } from "../utils/routingUtils.js";


/**
 * POST /api/routes/shortest
 * Body: { source: string, destination: string }
 * Runs Dijkstra on the DB graph and returns { path, distance }.
 */
export async function shortest(req, res) {
  try {
    const { source, destination } = req.body;

    if (!source || !destination) {
      return res.status(400).json({ error: "source and destination are required" });
    }
    if (source === destination) {
      return res.json({ path: [source], distance: 0 });
    }

    const warehouses = await Warehouse.find().lean();
    const edges = await Edge.find().lean();

    const nodes = warehouses.map(({ _id, __v, ...w }) => w);
    const edgeList = edges.map(({ _id, __v, ...e }) => e);

    const result = findShortestPath(nodes, edgeList, source, destination);

    if (!result) {
      return res.status(404).json({ error: "No route found between these warehouses" });
    }

    res.json(result);
  } catch (err) {
    console.error("shortest route error:", err);
    res.status(500).json({ error: "Failed to compute shortest route" });
  }
}

/**
 * POST /api/routes/multi-stop
 * Body: { startId: string, stopIds: string[] }
 * Solves open-path TSP and returns { order, path, distance, legs }.
 */
export async function multiStop(req, res) {
  try {
    const { startId, stopIds } = req.body;

    if (!startId || !Array.isArray(stopIds) || stopIds.length === 0) {
      return res.status(400).json({ error: "startId and a non-empty stopIds array are required" });
    }

    const warehouses = await Warehouse.find().lean();
    const edges = await Edge.find().lean();

    const nodes = warehouses.map(({ _id, __v, ...w }) => w);
    const edgeList = edges.map(({ _id, __v, ...e }) => e);

    const result = solveMultiStopRoute(nodes, edgeList, startId, stopIds);

    if (!result) {
      return res.status(404).json({ error: "No valid route connects all selected stops" });
    }

    res.json(result);
  } catch (err) {
    console.error("multi-stop route error:", err);
    res.status(500).json({ error: "Failed to compute multi-stop route" });
  }
}

/**
 * POST /api/routes/compare
 * Body: { source: string, destination: string }
 * Runs Yen's algorithm (k=2) and returns { routes: [{path, distance}] }.
 */
export async function compareRoutes(req, res) {
  try {
    const { source, destination } = req.body;

    if (!source || !destination) {
      return res.status(400).json({ error: "source and destination are required" });
    }
    if (source === destination) {
      return res.json({ routes: [{ path: [source], distance: 0 }] });
    }

    const warehouses = await Warehouse.find().lean();
    const edges = await Edge.find().lean();

    const nodes = warehouses.map(({ _id, __v, ...w }) => w);
    const edgeList = edges.map(({ _id, __v, ...e }) => e);

    const routes = findKShortestPaths(nodes, edgeList, source, destination, 2);

    if (!routes || routes.length === 0) {
      return res.status(404).json({ error: "No route found between these warehouses" });
    }

    res.json({ routes });
  } catch (err) {
    console.error("compare routes error:", err);
    res.status(500).json({ error: "Failed to compute comparison routes" });
  }
}

