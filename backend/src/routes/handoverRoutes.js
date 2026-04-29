import { Router } from "express";
import { requireAuth, requireOrganizationWriteAccess } from "../middleware/authMiddleware.js";
import { createHandover, getHandovers, getHandoverById } from "../services/handoverService.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    return res.json(await getHandovers(req.user.organizationId, req.user.sectorIds));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const handover = await getHandoverById(id, req.user.organizationId, req.user.sectorIds);

  if (!handover) {
    return res.status(404).json({ message: "Passagem de plantão não encontrada." });
  }

  return res.json(handover);
});

router.post("/", requireOrganizationWriteAccess, async (req, res) => {
  const { professionalId, bedIds } = req.body;

  if (!professionalId || !Array.isArray(bedIds) || bedIds.length === 0) {
    return res.status(400).json({ message: "Profissional e leitos são obrigatórios." });
  }

  try {
    const handover = await createHandover(req.user.organizationId, req.user.sectorIds, professionalId, bedIds);
    return res.status(201).json(handover);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
