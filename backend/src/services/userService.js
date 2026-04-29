import { randomBytes } from "node:crypto";
import { prisma } from "../middleware/prismaMiddleware.js";
import { buildOrganizationPayload, isOrganizationAllowed } from "./organizationService.js";
import { validateSectorIdsForOrganization } from "./sectorAccessService.js";
import { createPasswordHash, verifyPassword } from "../utils/password.js";

const sessions = new Map();
const temporarySessions = new Map();

const membershipInclude = {
  user: true,
  organization: true,
  sectors: {
    include: {
      sector: true
    },
    orderBy: { sectorId: "asc" }
  }
};

function normalizeRole(role) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  if (!["administrator", "coordinator", "routine", "oncall"].includes(normalizedRole)) {
    throw new Error("Perfil de acesso invalido.");
  }

  return normalizedRole;
}

function normalizeEmail(email) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Informe o e-mail.");
  }

  return normalizedEmail;
}

function normalizeLogin(login) {
  const normalizedLogin = String(login ?? "").trim().toLowerCase();

  if (!normalizedLogin) {
    throw new Error("Informe o login.");
  }

  return normalizedLogin;
}

function normalizeOrganizationId(organizationId) {
  const numericOrganizationId = Number(organizationId);

  if (!Number.isInteger(numericOrganizationId) || numericOrganizationId <= 0) {
    throw new Error("Organizacao da sessao invalida.");
  }

  return numericOrganizationId;
}

function notFoundUserError() {
  const notFoundError = new Error("Profissional nao encontrado nesta organizacao.");
  notFoundError.statusCode = 404;
  return notFoundError;
}

function buildGlobalUser(user) {
  return {
    id: user.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    login: user.login,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function getSectorAccess(membership) {
  return (membership.sectors ?? [])
    .map((assignment) => assignment.sector)
    .filter((sector) => sector && sector.organizationId === membership.organizationId)
    .map((sector) => ({
      id: sector.id,
      name: sector.name
    }));
}

function buildMembershipUser(membership) {
  const sectorAccess = getSectorAccess(membership);

  return {
    ...buildGlobalUser(membership.user),
    userOrganizationId: membership.id,
    organizationId: membership.organizationId,
    role: membership.role,
    jobTitle: membership.jobTitle ?? "",
    isActive: Boolean(membership.user.isActive && membership.isActive),
    sectorIds: sectorAccess.map((sector) => sector.id),
    sectors: sectorAccess,
    organization: membership.organization ? buildOrganizationPayload(membership.organization) : null
  };
}

function buildOrganizationOption(membership) {
  return {
    id: membership.organization.id,
    name: membership.organization.name,
    role: membership.role,
    jobTitle: membership.jobTitle ?? "",
    status: membership.organization.status,
    plan: membership.organization.plan,
    trialEndsAt: membership.organization.trialEndsAt,
    trialDaysRemaining: buildOrganizationPayload(membership.organization)?.trialDaysRemaining ?? 0
  };
}

function assertOrganizationCanBeAccessed(membership) {
  if (!membership?.organization?.isActive) {
    const error = new Error("Organizacao inativa. Procure o suporte.");
    error.statusCode = 403;
    throw error;
  }

  if (!isOrganizationAllowed(membership.organization)) {
    const error = new Error("Trial expirado ou organizacao sem acesso ativo.");
    error.statusCode = 402;
    throw error;
  }
}

function createFinalSession(membership) {
  assertOrganizationCanBeAccessed(membership);

  const token = `session-${randomBytes(24).toString("hex")}`;
  const safeUser = buildMembershipUser(membership);
  sessions.set(token, safeUser);

  return {
    token,
    user: safeUser,
    organization: safeUser.organization,
    role: safeUser.role,
    sectors: safeUser.sectors
  };
}

async function refreshMembershipSessions(userOrganizationId) {
  const membership = await prisma.userOrganization.findUnique({
    where: { id: userOrganizationId },
    include: membershipInclude
  });

  if (!membership) {
    for (const [token, sessionUser] of sessions.entries()) {
      if (sessionUser.userOrganizationId === userOrganizationId) {
        sessions.delete(token);
      }
    }
    return null;
  }

  const safeUser = buildMembershipUser(membership);

  for (const [token, sessionUser] of sessions.entries()) {
    if (sessionUser.userOrganizationId === userOrganizationId) {
      sessions.set(token, safeUser);
    }
  }

  return safeUser;
}

async function normalizeUserSectorIds(payload, organizationId, required) {
  const sectorIds = await validateSectorIdsForOrganization(payload?.sectorIds, organizationId);

  if (required && sectorIds.length === 0) {
    throw new Error("Selecione pelo menos um setor para o profissional.");
  }

  return sectorIds;
}

async function findMembershipByUserAndOrganization(userId, organizationId) {
  return prisma.userOrganization.findFirst({
    where: {
      userId: Number(userId),
      organizationId
    },
    include: membershipInclude
  });
}

async function createMembershipSectors(tx, userOrganizationId, sectorIds) {
  if (sectorIds.length === 0) {
    return;
  }

  await tx.userOrganizationSector.createMany({
    data: sectorIds.map((sectorId) => ({
      userOrganizationId,
      sectorId
    })),
    skipDuplicates: true
  });
}

export async function authenticateUser(identifier, password) {
  const normalizedIdentifier = String(identifier ?? "").trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { mode: "insensitive", equals: normalizedIdentifier } },
        { login: { mode: "insensitive", equals: normalizedIdentifier } }
      ]
    },
    include: {
      organizations: {
        where: { isActive: true },
        include: membershipInclude,
        orderBy: { organizationId: "asc" }
      }
    }
  });

  if (!user || !(await verifyPassword(password, user.password))) {
    throw new Error("Login ou senha invalidos.");
  }

  if (!user.isActive) {
    const inactiveError = new Error("Usuario inativo. Procure um administrador.");
    inactiveError.statusCode = 403;
    throw inactiveError;
  }

  const memberships = user.organizations.filter((membership) => membership.organization?.isActive);

  if (memberships.length === 0) {
    const error = new Error("Usuario sem organizacao ativa vinculada.");
    error.statusCode = 403;
    throw error;
  }

  if (memberships.length === 1) {
    return createFinalSession(memberships[0]);
  }

  const temporaryToken = `temporary-${randomBytes(24).toString("hex")}`;
  temporarySessions.set(temporaryToken, {
    userId: user.id,
    createdAt: Date.now()
  });

  return {
    requiresOrganizationSelection: true,
    temporaryToken,
    user: buildGlobalUser(user),
    organizations: memberships.map(buildOrganizationOption)
  };
}

export async function selectOrganization(temporaryToken, organizationId) {
  const temporarySession = temporarySessions.get(String(temporaryToken ?? ""));

  if (!temporarySession) {
    const error = new Error("Selecao de organizacao expirada. Faca login novamente.");
    error.statusCode = 401;
    throw error;
  }

  const scopedOrganizationId = normalizeOrganizationId(organizationId);
  const membership = await prisma.userOrganization.findFirst({
    where: {
      userId: temporarySession.userId,
      organizationId: scopedOrganizationId,
      isActive: true
    },
    include: membershipInclude
  });

  if (!membership || !membership.user?.isActive) {
    const error = new Error("Usuario nao possui acesso ativo a esta organizacao.");
    error.statusCode = 403;
    throw error;
  }

  const result = createFinalSession(membership);
  temporarySessions.delete(temporaryToken);
  return result;
}

export function getUserByToken(token) {
  return sessions.get(token);
}

export function logoutUser(token) {
  sessions.delete(token);
}

export async function listUsers(organizationId) {
  const scopedOrganizationId = normalizeOrganizationId(organizationId);

  const memberships = await prisma.userOrganization.findMany({
    where: {
      organizationId: scopedOrganizationId
    },
    include: membershipInclude,
    orderBy: { createdAt: "desc" }
  });

  return memberships.map(buildMembershipUser);
}

export async function listActiveProfessionals(organizationId) {
  const scopedOrganizationId = normalizeOrganizationId(organizationId);

  const memberships = await prisma.userOrganization.findMany({
    where: {
      organizationId: scopedOrganizationId,
      isActive: true,
      user: { isActive: true }
    },
    include: membershipInclude,
    orderBy: { createdAt: "asc" }
  });

  return memberships
    .map(buildMembershipUser)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function createUser(payload, organizationId) {
  const scopedOrganizationId = normalizeOrganizationId(organizationId);
  const name = String(payload?.name ?? "").trim();
  const email = normalizeEmail(payload?.email);
  const login = normalizeLogin(payload?.login);
  const password = String(payload?.password ?? "");
  const jobTitle = String(payload?.jobTitle ?? payload?.role ?? "").trim();
  const role = normalizeRole(payload?.role);
  const isActive = Boolean(payload?.isActive);
  const sectorIds = await normalizeUserSectorIds(payload, scopedOrganizationId, true);

  if (!name) {
    throw new Error("Informe o nome completo.");
  }

  if (!jobTitle) {
    throw new Error("Informe o cargo ou funcao.");
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email }
  });
  const existingLogin = await prisma.user.findUnique({
    where: { login }
  });

  if (existingEmail && existingLogin && existingEmail.id !== existingLogin.id) {
    throw new Error("E-mail e login pertencem a usuarios diferentes.");
  }

  const existingUser = existingEmail ?? existingLogin;

  if (existingUser && (existingUser.email !== email || existingUser.login !== login)) {
    throw new Error("E-mail e login precisam corresponder ao mesmo usuario ja cadastrado.");
  }

  if (!existingUser && !password) {
    throw new Error("Informe a senha inicial.");
  }

  if (existingUser) {
    const existingMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: scopedOrganizationId
        }
      }
    });

    if (existingMembership) {
      throw new Error("Este profissional ja esta vinculado a organizacao atual.");
    }
  }

  const membership = await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? existingUser
      : await tx.user.create({
          data: {
            name,
            email,
            login,
            password: createPasswordHash(password),
            isActive: true
          }
        });

    const createdMembership = await tx.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: scopedOrganizationId,
        role,
        jobTitle,
        isActive
      }
    });

    await createMembershipSectors(tx, createdMembership.id, sectorIds);

    return tx.userOrganization.findUnique({
      where: { id: createdMembership.id },
      include: membershipInclude
    });
  });

  return buildMembershipUser(membership);
}

export async function updateUser(userId, payload, organizationId) {
  const scopedOrganizationId = normalizeOrganizationId(organizationId);
  const numericUserId = Number(userId);

  const membership = await findMembershipByUserAndOrganization(numericUserId, scopedOrganizationId);

  if (!membership) {
    throw notFoundUserError();
  }

  const name = String(payload?.name ?? membership.user.name).trim();
  const email = normalizeEmail(payload?.email ?? membership.user.email);
  const login = normalizeLogin(payload?.login ?? membership.user.login);
  const jobTitle = String(payload?.jobTitle ?? membership.jobTitle ?? "").trim();
  const role = normalizeRole(payload?.role ?? membership.role);
  const sectorIds =
    payload?.sectorIds !== undefined ? await normalizeUserSectorIds(payload, scopedOrganizationId, true) : null;

  if (!name) {
    throw new Error("Informe o nome completo.");
  }

  if (!jobTitle) {
    throw new Error("Informe o cargo ou funcao.");
  }

  if (email !== membership.user.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    });
    if (existingEmail && existingEmail.id !== numericUserId) {
      throw new Error("Ja existe um profissional com este e-mail.");
    }
  }

  if (login !== membership.user.login) {
    const existingLogin = await prisma.user.findUnique({
      where: { login }
    });
    if (existingLogin && existingLogin.id !== numericUserId) {
      throw new Error("Ja existe um profissional com este login.");
    }
  }

  const updatedMembership = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: numericUserId },
      data: {
        name,
        email,
        login
      }
    });

    await tx.userOrganization.update({
      where: { id: membership.id },
      data: {
        role,
        jobTitle,
        ...(typeof payload?.isActive === "boolean" && { isActive: payload.isActive })
      }
    });

    if (sectorIds) {
      await tx.userOrganizationSector.deleteMany({
        where: { userOrganizationId: membership.id }
      });

      await createMembershipSectors(tx, membership.id, sectorIds);
    }

    return tx.userOrganization.findUnique({
      where: { id: membership.id },
      include: membershipInclude
    });
  });

  await refreshMembershipSessions(membership.id);
  return buildMembershipUser(updatedMembership);
}

export async function updateUserStatus(userId, isActive, organizationId) {
  const scopedOrganizationId = normalizeOrganizationId(organizationId);
  const numericUserId = Number(userId);
  const membership = await findMembershipByUserAndOrganization(numericUserId, scopedOrganizationId);

  if (!membership) {
    throw notFoundUserError();
  }

  const updated = await prisma.userOrganization.update({
    where: { id: membership.id },
    data: { isActive: Boolean(isActive) },
    include: membershipInclude
  });

  await refreshMembershipSessions(membership.id);
  return buildMembershipUser(updated);
}

export async function resetUserPassword(userId, password, organizationId) {
  const scopedOrganizationId = normalizeOrganizationId(organizationId);
  const numericUserId = Number(userId);
  const membership = await findMembershipByUserAndOrganization(numericUserId, scopedOrganizationId);

  if (!membership) {
    throw notFoundUserError();
  }

  const nextPassword = String(password ?? "");

  if (!nextPassword) {
    throw new Error("Informe a nova senha.");
  }

  await prisma.user.update({
    where: { id: numericUserId },
    data: { password: createPasswordHash(nextPassword) }
  });

  const updatedMembership = await findMembershipByUserAndOrganization(numericUserId, scopedOrganizationId);
  return buildMembershipUser(updatedMembership);
}
