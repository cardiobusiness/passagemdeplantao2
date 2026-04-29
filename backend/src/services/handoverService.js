import { prisma } from "../middleware/prismaMiddleware.js";
import { activeBedWhere, getAccessibleSectorIds } from "./sectorAccessService.js";

async function getAccessibleBedIds(organizationId, sectorIds) {
  if (!sectorIds?.length) {
    return [];
  }

  const beds = await prisma.bed.findMany({
    where: activeBedWhere(organizationId, sectorIds),
    select: { id: true }
  });

  return beds.map((bed) => bed.id);
}

function filterHandoverBeds(handover, accessibleBedIds) {
  const accessibleBedIdSet = new Set(accessibleBedIds);

  return {
    ...handover,
    bedIds: handover.bedIds.filter((bedId) => accessibleBedIdSet.has(bedId))
  };
}

async function assertBedAccess(organizationId, sectorIds, bedIds, message) {
  const beds = await prisma.bed.findMany({
    where: {
      id: { in: bedIds },
      ...activeBedWhere(organizationId, sectorIds)
    },
    select: { id: true }
  });

  if (beds.length !== bedIds.length) {
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
  }
}

export async function createHandover(organizationId, requesterSectorIds, professionalId, bedIds) {
  const professionalMembership = await prisma.userOrganization.findFirst({
    where: {
      userId: Number(professionalId),
      organizationId,
      isActive: true,
      user: { isActive: true }
    }
  });

  if (!professionalMembership) {
    const error = new Error("Profissional nao encontrado nesta organizacao.");
    error.statusCode = 404;
    throw error;
  }

  const normalizedBedIds = [...new Set(bedIds.map((bedId) => Number(bedId)).filter(Number.isInteger))];

  if (normalizedBedIds.length === 0) {
    throw new Error("Informe pelo menos um leito valido.");
  }

  await assertBedAccess(
    organizationId,
    requesterSectorIds,
    normalizedBedIds,
    "Um ou mais leitos nao estao liberados para a sua sessao."
  );

  const professionalSectorIds = await getAccessibleSectorIds(professionalMembership.id, organizationId);

  await assertBedAccess(
    organizationId,
    professionalSectorIds,
    normalizedBedIds,
    "Um ou mais leitos nao estao liberados para o profissional selecionado."
  );

  const beds = await prisma.bed.findMany({
    where: {
      organizationId,
      id: { in: normalizedBedIds }
    },
    select: { id: true }
  });

  if (beds.length !== normalizedBedIds.length) {
    const error = new Error("Um ou mais leitos nao pertencem a organizacao logada.");
    error.statusCode = 403;
    throw error;
  }

  return prisma.handover.create({
    data: {
      organizationId,
      professionalId: Number(professionalId),
      bedIds: normalizedBedIds
    }
  });
}

export async function getHandovers(organizationId, sectorIds) {
  const accessibleBedIds = await getAccessibleBedIds(organizationId, sectorIds);

  if (accessibleBedIds.length === 0) {
    return [];
  }

  const handovers = await prisma.handover.findMany({
    where: {
      organizationId,
      bedIds: { hasSome: accessibleBedIds }
    },
    orderBy: { createdAt: "desc" }
  });

  return handovers.map((handover) => filterHandoverBeds(handover, accessibleBedIds));
}

export async function getHandoverById(id, organizationId, sectorIds) {
  const accessibleBedIds = await getAccessibleBedIds(organizationId, sectorIds);

  if (accessibleBedIds.length === 0) {
    return null;
  }

  const handover = await prisma.handover.findFirst({
    where: {
      id: Number(id),
      organizationId,
      bedIds: { hasSome: accessibleBedIds }
    }
  });

  return handover ? filterHandoverBeds(handover, accessibleBedIds) : null;
}
