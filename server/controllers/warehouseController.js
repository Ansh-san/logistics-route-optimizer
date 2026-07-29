import Warehouse from "../models/Warehouse.js";
import Edge from "../models/Edge.js";

/**
 * GET /api/warehouses/graph
 * Returns the full graph: all warehouses (nodes) and edges.
 */
export async function getGraph(req, res) {
  try {
    const warehouses = await Warehouse.find().lean();
    const edges = await Edge.find().lean();

    // Strip Mongo internals for a clean response
    const cleanWarehouses = warehouses.map(({ _id, __v, ...w }) => w);
    const cleanEdges = edges.map(({ _id, __v, ...e }) => e);

    res.json({ warehouses: cleanWarehouses, edges: cleanEdges });
  } catch (err) {
    console.error("getGraph error:", err);
    res.status(500).json({ error: "Failed to fetch graph data" });
  }
}
