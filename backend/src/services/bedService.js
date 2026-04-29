import { prisma } from "../middleware/prismaMiddleware.js";
import { mapBedRecord } from "../utils/patientMapper.js";
import { activeBedWhere } from "./sectorAccessService.js";

function activeOrganizationBedWhere(organizationId) {
  return {
    organizationId,
    occupied: true,
    isActive: true,
    OR: [{ sectorId: null }, { sector: { isActive: true } }]
  };
}

function getPatientInclude(organizationId, sectorIds = null) {
  return {
    beds: {
      where: sectorIds ? { ...activeBedWhere(organizationId, sectorIds), occupied: true } : activeOrganizationBedWhere(organizationId),
      take: 1,
      orderBy: { id: "asc" }
    },
    admissionMetrics: true,
    labs: { orderBy: { date: "desc" } },
    imaging: { orderBy: { date: "desc" } },
    evolutions: { orderBy: { date: "desc" } },
    alerts: { where: { isActive: true } }
  };
}

function getBedInclude(organizationId, sectorIds = null) {
  return {
    sector: true,
    patient: {
      include: getPatientInclude(organizationId, sectorIds)
    }
  };
}

function normalizeCode(code) {
  const normalizedCode = String(code ?? "").trim().toUpperCase();

  if (!normalizedCode) {
    throw new Error("Codigo do leito nao informado.");
  }

  return normalizedCode;
}

async function getSectorForBed(sectorId, organizationId) {
  const numericSectorId = Number(sectorId);

  if (!Number.isInteger(numericSectorId) || numericSectorId <= 0) {
    throw new Error("Selecione um setor valido.");
  }

  const sector = await prisma.sector.findFirst({
    where: {
      id: numericSectorId,
      organizationId
    }
  });

  if (!sector) {
    const error = new Error("Setor nao encontrado nesta organizacao.");
    error.statusCode = 404;
    throw error;
  }

  if (!sector.isActive) {
    throw new Error("Selecione um setor ativo para o leito.");
  }

  return sector;
}

export async function getBeds(organizationId, sectorIds) {
  const beds = await prisma.bed.findMany({
    where: activeBedWhere(organizationId, sectorIds),
    include: getBedInclude(organizationId, sectorIds),
    orderBy: [{ sectorName: "asc" }, { code: "asc" }]
  });

  return beds.map(mapBedRecord);
}

export async function getAdminBeds(organizationId) {
  const beds = await prisma.bed.findMany({
    where: {
      organizationId
    },
    include: getBedInclude(organizationId),
    orderBy: [{ sectorName: "asc" }, { code: "asc" }]
  });

  return beds.map(mapBedRecord);
}

export async function getBedById(bedId, organizationId, sectorIds) {
  const bed = await prisma.bed.findFirst({
    where: {
      id: Number(bedId),
      ...activeBedWhere(organizationId, sectorIds)
    },
    include: getBedInclude(organizationId, sectorIds)
  });

  if (!bed) {
    const error = new Error("Leito nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  return mapBedRecord(bed);
}

export async function createBed(payload, organizationId) {
  const code = normalizeCode(payload?.code);
  const sector = await getSectorForBed(payload?.sectorId, organizationId);

  const existingBed = await prisma.bed.findFirst({
    where: {
      organizationId,
      code
    }
  });

  if (existingBed) {
    throw new Error("Ja existe um leito com este codigo nesta organizacao.");
  }

  const bed = await prisma.bed.create({
    data: {
      organizationId,
      sectorId: sector.id,
      code,
      sectorName: sector.name,
      occupied: false,
      status: "Vago",
      isActive: typeof payload?.isActive === "boolean" ? payload.isActive : true
    },
    include: getBedInclude(organizationId)
  });

  return mapBedRecord(bed);
}

export async function updateBed(bedId, payload, organizationId) {
  const numericBedId = Number(bedId);

  if (!Number.isInteger(numericBedId) || numericBedId <= 0) {
    throw new Error("Leito invalido.");
  }

  const bed = await prisma.bed.findFirst({
    where: {
      id: numericBedId,
      organizationId
    }
  });

  if (!bed) {
    const error = new Error("Leito nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const nextData = {};

  if (payload?.code !== undefined) {
    const code = normalizeCode(payload.code);

    if (code !== bed.code) {
      const existingBed = await prisma.bed.findFirst({
        where: {
          organizationId,
          code,
          NOT: { id: numericBedId }
        }
      });

      if (existingBed) {
        throw new Error("Ja existe um leito com este codigo nesta organizacao.");
      }
    }

    nextData.code = code;
  }

  if (payload?.sectorId !== undefined) {
    const sector = await getSectorForBed(payload.sectorId, organizationId);
    nextData.sectorId = sector.id;
    nextData.sectorName = sector.name;
  }

  if (payload?.isActive === false && bed.occupied) {
    throw new Error("Nao e possivel desativar um leito ocupado.");
  }

  if (payload?.patientId) {
    const patient = await prisma.patient.findFirst({
      where: {
        id: Number(payload.patientId),
        organizationId
      }
    });

    if (!patient) {
      const error = new Error("Paciente nao encontrado nesta organizacao.");
      error.statusCode = 404;
      throw error;
    }
  }

  const updated = await prisma.bed.update({
    where: { id: numericBedId },
    data: {
      ...nextData,
      ...(payload?.occupied !== undefined && { occupied: Boolean(payload.occupied) }),
      ...(payload?.status && { status: String(payload.status) }),
      ...(typeof payload?.isActive === "boolean" && { isActive: payload.isActive }),
      ...(payload?.patientId !== undefined && { patientId: payload.patientId ? Number(payload.patientId) : null })
    },
    include: getBedInclude(organizationId)
  });

  return mapBedRecord(updated);
}
