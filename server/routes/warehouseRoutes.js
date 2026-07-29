import { Router } from "express";
import { getGraph } from "../controllers/warehouseController.js";

const router = Router();

router.get("/graph", getGraph);

export default router;
