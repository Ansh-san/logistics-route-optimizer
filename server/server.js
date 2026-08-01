import "./dns-fix.js";
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import warehouseRoutes from "./routes/warehouseRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(
  cors({
    origin: "https://logistics-route-optimizer.netlify.app",
  })
);
app.use(express.json());

// --- API Routes ---
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/routes", routeRoutes);

// --- Health check ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// --- Connect to MongoDB & start server ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not set in .env — cannot start.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅  Connected to MongoDB Atlas");
    app.listen(PORT, () => {
      console.log(`🚀  Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  });
