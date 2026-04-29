import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getMonthlyDashboard } from "../services/dashboardService.js";

const router = Router();

router.use(requireAuth);

router.get("/monthly", async (req, res) => {
  try {
    const dashboard = await getMonthlyDashboard(req.user.organizationId, req.user.sectorIds);
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({
      message: "Nao foi possivel carregar o dashboard.",
      error: error.message
    });
  }
});

export default router;
