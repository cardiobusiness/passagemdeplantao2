import { Router } from "express";
import {
  requireAdminManagementAccess,
  requireAuth,
  requireOrganizationWriteAccess
} from "../middleware/authMiddleware.js";
import { createBed, getAdminBeds, getBeds, updateBed } from "../services/bedService.js";

const router = Router();

router.use(requireAuth);

router.get("/admin", requireAdminManagementAccess, async (req, res) => {
  try {
    const beds = await getAdminBeds(req.user.organizationId);
    res.json(beds);
  } catch (error) {
    res.status(500).json({
      message: "Nao foi possivel carregar os leitos.",
      error: error.message,
    });
  }
});

router.post("/admin", requireAdminManagementAccess, requireOrganizationWriteAccess, async (req, res) => {
  try {
    const bed = await createBed(req.body, req.user.organizationId);
    res.status(201).json(bed);
  } catch (error) {
    res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.patch("/admin", requireAdminManagementAccess, requireOrganizationWriteAccess, async (req, res) => {
  try {
    const bed = await updateBed(req.body?.id, req.body, req.user.organizationId);
    res.json(bed);
  } catch (error) {
    res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.patch("/admin/:id", requireAdminManagementAccess, requireOrganizationWriteAccess, async (req, res) => {
  try {
    const bed = await updateBed(req.params.id, req.body, req.user.organizationId);
    res.json(bed);
  } catch (error) {
    res.status(error.statusCode ?? 400).json({ message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const beds = await getBeds(req.user.organizationId, req.user.sectorIds);
    res.json(beds);
  } catch (error) {
    res.status(500).json({
      message: "Nao foi possivel carregar os leitos.",
      error: error.message,
    });
  }
});

export default router;
