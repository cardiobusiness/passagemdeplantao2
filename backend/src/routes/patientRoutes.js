import { Router } from "express";
import { requireAuth, requireOrganizationWriteAccess } from "../middleware/authMiddleware.js";
import {
  createPatient,
  createPatientLab,
  deletePatientLab,
  dischargePatient,
  getPatientById,
  getPatientLabs,
  getPatients,
  updatePatientLab,
  updatePatientClinicalData
} from "../services/patientService.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const patients = await getPatients(req.user.organizationId, req.user.sectorIds);
    res.json(patients);
  } catch (error) {
    res.status(500).json({
      message: "Nao foi possivel carregar os pacientes.",
      error: error.message
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const patient = await getPatientById(req.params.id, req.user.organizationId, req.user.sectorIds);
    return res.json(patient);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
});

router.post("/", requireOrganizationWriteAccess, async (req, res) => {
  try {
    const patient = await createPatient(req.body, req.user.organizationId, req.user.sectorIds);
    return res.status(201).json(patient);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get("/:id/labs", async (req, res) => {
  try {
    const labs = await getPatientLabs(req.params.id, req.user.organizationId, req.user.sectorIds);
    return res.json(labs);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
});

router.post("/:id/labs", requireOrganizationWriteAccess, async (req, res) => {
  try {
    const lab = await createPatientLab(req.params.id, req.body, req.user.organizationId, req.user.sectorIds);
    return res.status(201).json(lab);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
});

router.put("/:id/labs/:labId", requireOrganizationWriteAccess, async (req, res) => {
  try {
    const lab = await updatePatientLab(req.params.id, req.params.labId, req.body, req.user.organizationId, req.user.sectorIds);
    return res.json(lab);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
});

router.delete("/:id/labs/:labId", requireOrganizationWriteAccess, async (req, res) => {
  try {
    const lab = await deletePatientLab(req.params.id, req.params.labId, req.user.organizationId, req.user.sectorIds);
    return res.json(lab);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
});

router.post("/:id/discharge", requireOrganizationWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dischargePatient(id, req.body, req.user.organizationId, req.user.sectorIds);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.patch("/:id/clinical-data", requireOrganizationWriteAccess, async (req, res) => {
  try {
    const result = await updatePatientClinicalData(req.params.id, req.body, req.user.organizationId, req.user.sectorIds);
    return res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
});

export default router;
