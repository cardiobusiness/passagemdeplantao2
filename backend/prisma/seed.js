import { PrismaClient } from "@prisma/client";
import { createPasswordHash } from "../src/utils/password.js";

const prisma = new PrismaClient();

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

async function ensureDefaultOrganization() {
  const existingOrganization = await prisma.organization.findFirst({
    where: { name: "Organização Padrão" },
    orderBy: { id: "asc" }
  });

  if (existingOrganization) {
    return existingOrganization;
  }

  return prisma.organization.create({
    data: {
      name: "Organização Padrão",
      plan: "trial",
      status: "trial",
      trialStartsAt: new Date(),
      trialEndsAt: addDays(new Date(), 60),
      isActive: true
    }
  });
}

async function upsertUser(user) {
  const existingUser = await prisma.user.upsert({
    where: { login: user.login },
    update: {
      name: user.name,
      email: user.email,
      password: createPasswordHash(user.password),
      isActive: true
    },
    create: {
      name: user.name,
      email: user.email,
      login: user.login,
      password: createPasswordHash(user.password),
      isActive: true
    }
  });

  return {
    ...existingUser,
    seedRole: user.role,
    seedJobTitle: user.jobTitle
  };
}

async function upsertUserOrganization(organizationId, user) {
  return prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId
      }
    },
    update: {
      role: user.seedRole,
      jobTitle: user.seedJobTitle,
      isActive: true
    },
    create: {
      userId: user.id,
      organizationId,
      role: user.seedRole,
      jobTitle: user.seedJobTitle,
      isActive: true
    }
  });
}

async function main() {
  const organization = await ensureDefaultOrganization();

  const users = await Promise.all([
    upsertUser({
      name: "Administrador",
      email: "admin@cti.com",
      login: "admin",
      password: "Admin@123",
      jobTitle: "Administrador",
      role: "administrator"
    }),
    upsertUser({
      name: "Coordenador",
      email: "coordenador@cti.com",
      login: "coordenador",
      password: "Coord@123",
      jobTitle: "Coordenador",
      role: "coordinator"
    }),
    upsertUser({
      name: "Rotina",
      email: "rotina@cti.com",
      login: "rotina",
      password: "Rotina@123",
      jobTitle: "Fisioterapeuta",
      role: "routine"
    }),
    upsertUser({
      name: "Plantonista",
      email: "plantonista@cti.com",
      login: "plantonista",
      password: "Plantao@123",
      jobTitle: "Fisioterapeuta",
      role: "oncall"
    })
  ]);

  const defaultSector = await prisma.sector.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "CTI 1"
      }
    },
    update: {
      isActive: true
    },
    create: {
      organizationId: organization.id,
      name: "CTI 1",
      isActive: true
    }
  });

  const memberships = await Promise.all(users.map((user) => upsertUserOrganization(organization.id, user)));

  await prisma.userOrganizationSector.createMany({
    data: memberships.map((membership) => ({
      userOrganizationId: membership.id,
      sectorId: defaultSector.id
    })),
    skipDuplicates: true
  });

  for (let i = 101; i <= 140; i += 1) {
    const code = `L${i}`;
    await prisma.bed.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code
        }
      },
      update: {
        sectorId: defaultSector.id,
        sectorName: defaultSector.name,
        isActive: true
      },
      create: {
        organizationId: organization.id,
        sectorId: defaultSector.id,
        code,
        sectorName: defaultSector.name,
        occupied: false,
        status: "Vago"
      }
    });
  }

  console.log("Seed concluido com sucesso.");
  console.log(`Organizacao: ${organization.name}`);
  console.log("Login admin: admin");
  console.log("Senha admin: Admin@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
