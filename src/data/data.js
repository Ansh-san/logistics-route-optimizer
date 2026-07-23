// data.js
// Static graph definition for the logistics network.
// Distances are approximate real road distances (km), not straight-line.
// Not every warehouse is directly connected — this forces Dijkstra to
// actually route through intermediate hubs, which is the point.

export const warehouses = [
  { id: "delhi",     name: "Delhi",     lat: 28.7041, lng: 77.1025 },
  { id: "mumbai",    name: "Mumbai",    lat: 19.0760, lng: 72.8777 },
  { id: "bengaluru", name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { id: "kolkata",   name: "Kolkata",   lat: 22.5726, lng: 88.3639 },
  { id: "hyderabad", name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { id: "chennai",   name: "Chennai",   lat: 13.0827, lng: 80.2707 },
];

// Undirected weighted edges. Distance = road km (approx).
// Hyderabad acts as the natural central hub, mirroring its real
// position roughly in the geographic middle of these six cities.
export const edges = [
  { source: "delhi",     target: "mumbai",    distance: 1424 },
  { source: "delhi",     target: "kolkata",   distance: 1472 },
  { source: "delhi",     target: "hyderabad", distance: 1553 },
  { source: "mumbai",    target: "hyderabad", distance: 711 },
  { source: "mumbai",    target: "bengaluru", distance: 984 },
  { source: "hyderabad", target: "bengaluru", distance: 575 },
  { source: "hyderabad", target: "chennai",   distance: 626 },
  { source: "hyderabad", target: "kolkata",   distance: 1489 },
  { source: "bengaluru", target: "chennai",   distance: 346 },
  { source: "chennai",   target: "kolkata",   distance: 1673 },
];

// Convenience lookup map, useful in components that need coords by id.
export const warehouseMap = warehouses.reduce((acc, w) => {
  acc[w.id] = w;
  return acc;
}, {});