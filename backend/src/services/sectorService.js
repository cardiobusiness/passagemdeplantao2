import { prisma } from "../middleware/prismaMiddleware.js";

function normalizeName(name) {
  const normalizedName = String(name ?? "").trim();

  if (!normalizedName) {
    throw new Error("Informe o nome do setor.");
  }

  return normalizedName;
}

function mapSector(sector) {
  return {
    id: sector.id,
    organizationId: sector.organizationId,
    name: sector.name,
    isActive: sector.isActive,
    bedCount: sector._count?.beds ?? 0,
    createdAt: sector.createdAt,
    updatedAt: sector.updatedAt
  };
}

export async function listSectors(organizationId) {
  const sectors = await prisma.sector.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: { beds: true }
      }
    },
    orderBy: { name: "asc" }
  });

  return sectors.map(mapSector);
}

export async function createSector(payload, organizationId) {
  const name = normalizeName(payload?.name);

  const existingSector = await prisma.sector.findFirst({
    where: {
      organizationId,
      name: {
        equals: name,
        mode: "insensitive"
      }
    }
  });

  if (existingSector) {
    throw new Error("Ja existe um setor com este nome nesta organizacao.");
  }

  const sector = await prisma.sector.create({
    data: {
      organizationId,
      name,
      isActive: typeof payload?.isActive === "boolean" ? payload.isActive : true
    },
    include: {
      _count: {
        select: { beds: true }
      }
    }
  });

  return mapSector(sector);
}

export async function updateSector(sectorId, payload, organizationId) {
  const numericSectorId = Number(sectorId);

  if (!Number.isInteger(numericSectorId) || numericSectorId <= 0) {
    throw new Error("Setor invalido.");
  }

  const sector = await prisma.sector.findFirst({
    where: {
      id: numericSectorId,
      organizationId
    }
  });

  if (!sector) {
    const error = new Error("Setor nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const data = {};

  if (payload?.name !== undefined) {
    const name = normalizeName(payload.name);

    if (name !== sector.name) {
      const existingSector = await prisma.sector.findFirst({
        where: {
          organizationId,
          name: {
            equals: name,
            mode: "insensitive"
          },
          NOT: { id: numericSectorId }
        }
      });

      if (existingSector) {
        throw new Error("Ja existe um setor com este nome nesta organizacao.");
      }
    }

    data.name = name;
  }

  if (typeof payload?.isActive === "boolean") {
    if (!payload.isActive) {
      const occupiedBeds = await prisma.bed.count({
        where: {
          organizationId,
          sectorId: numericSectorId,
          occupied: true
        }
      });

      if (occupiedBeds > 0) {
        throw new Error("Nao e possivel desativar um setor com leitos ocupados.");
      }
    }

    data.isActive = payload.isActive;
  }

  const updatedSector = await prisma.$transaction(async (tx) => {
    const updated = await tx.sector.update({
      where: { id: numericSectorId },
      data,
      include: {
        _count: {
          select: { beds: true }
        }
      }
    });

    if (data.name) {
      await tx.bed.updateMany({
        where: {
          organizationId,
          sectorId: numericSectorId
        },
        data: { sectorName: data.name }
      });
    }

    return updated;
  });

  return mapSector(updatedSector);
}
