// seed.js — Populates MongoDB with the warehouse graph data.
// Run with: npm run seed  (or: node seed.js)

import "./dns-fix.js";
import "dotenv/config";
import mongoose from "mongoose";
import Warehouse from "./models/Warehouse.js";
import Edge from "./models/Edge.js";

const warehouses = [
  { id: "delhi",     name: "Delhi",     lat: 28.7041, lng: 77.1025 },
  { id: "mumbai",    name: "Mumbai",    lat: 19.0760, lng: 72.8777 },
  { id: "bengaluru", name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { id: "kolkata",   name: "Kolkata",   lat: 22.5726, lng: 88.3639 },
  { id: "hyderabad", name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { id: "chennai",   name: "Chennai",   lat: 13.0827, lng: 80.2707 },
];

const edges = [
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

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌  MONGODB_URI not set in .env — cannot seed.");
    process.exit(1);
  }

  console.log("🔗  Connecting to MongoDB Atlas…");
  await mongoose.connect(uri);
  console.log("✅  Connected.");

  // Drop existing data
  await Warehouse.deleteMany({});
  await Edge.deleteMany({});
  console.log("🗑️   Cleared existing warehouses and edges.");

  // Insert fresh data
  await Warehouse.insertMany(warehouses);
  await Edge.insertMany(edges);
  console.log(`📦  Inserted ${warehouses.length} warehouses and ${edges.length} edges.`);

  await mongoose.disconnect();
  console.log("🔌  Disconnected. Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
