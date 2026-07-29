import { Router } from "express";
import { shortest, multiStop } from "../controllers/routeController.js";

const router = Router();

router.post("/shortest", shortest);
router.post("/multi-stop", multiStop);

export default router;
