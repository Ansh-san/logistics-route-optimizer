import { Router } from "express";
import { shortest, multiStop, compareRoutes } from "../controllers/routeController.js";

const router = Router();

router.post("/shortest", shortest);
router.post("/multi-stop", multiStop);
router.post("/compare", compareRoutes);

export default router;

