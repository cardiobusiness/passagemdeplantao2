import { prisma } from "../middleware/prismaMiddleware.js";

function numericId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function normalizeSectorIds(sectorIds) {
  if (!Array.isArray(sectorIds)) {
    return [];
  }

  return [...new Set(sectorIds.map(numericId).filter(Boolean))];
}

export function emptyWhere() {
  return { id: -1 };
}

export async function validateSectorIdsForOrganization(sectorIds, organizationId) {
  const normalizedSectorIds = normalizeSectorIds(sectorIds);

  if (normalizedSectorIds.length === 0) {
    return [];
  }

  const sectors = await prisma.sector.findMany({
    where: {
      id: { in: normalizedSectorIds },
      organizationId
    },
    select: { id: true }
  });

  if (sectors.length !== normalizedSectorIds.length) {
    const error = new Error("Um ou mais setores nao pertencem a organizacao logada.");
    error.statusCode = 403;
    throw error;
  }

  return normalizedSectorIds;
}

export async function getAccessibleSectorIds(userOrganizationId, organizationId) {
  const numericUserOrganizationId = numericId(userOrganizationId);

  if (!numericUserOrganizationId) {
    return [];
  }

  const sectors = await prisma.userOrganizationSector.findMany({
    where: {
      userOrganizationId: numericUserOrganizationId,
      userOrganization: {
        organizationId,
        isActive: true
      },
      sector: {
        organizationId,
        isActive: true
      }
    },
    select: { sectorId: true }
  });

  return sectors.map((sector) => sector.sectorId);
}

export function activeBedWhere(organizationId, sectorIds) {
  const allowedSectorIds = normalizeSectorIds(sectorIds);

  if (!allowedSectorIds.length) {
    return emptyWhere();
  }

  return {
    organizationId,
    isActive: true,
    sectorId: { in: allowedSectorIds },
    sector: { isActive: true }
  };
}

export function activePatientWhere(organizationId, sectorIds) {
  const allowedSectorIds = normalizeSectorIds(sectorIds);

  if (!allowedSectorIds.length) {
    return emptyWhere();
  }

  return {
    organizationId,
    beds: {
      some: {
        organizationId,
        occupied: true,
        isActive: true,
        sectorId: { in: allowedSectorIds },
        sector: { isActive: true }
      }
    }
  };
}
