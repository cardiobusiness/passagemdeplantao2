import { getUserByToken } from "../services/userService.js";
import { isOrganizationAllowed } from "../services/organizationService.js";

function getBearerToken(req) {
  const authorization = req.headers.authorization ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export function requireAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: "Acesso nao autorizado." });
  }

  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({ message: "Sessao invalida ou expirada." });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: "Usuario inativo. Procure um administrador." });
  }

  req.user = {
    ...user,
    sectorIds: Array.isArray(user.sectorIds) ? user.sectorIds : []
  };
  req.authToken = token;
  next();
}

export function requireAdministrator(req, res, next) {
  if (!req.user || req.user.role !== "administrator") {
    return res.status(403).json({ message: "Somente administradores podem acessar esta area." });
  }

  next();
}

export function requireAdminManagementAccess(req, res, next) {
  if (!req.user || !["administrator", "routine"].includes(req.user.role)) {
    return res.status(403).json({ message: "Somente administradores e rotina podem acessar esta area." });
  }

  next();
}

export function requireOrganizationWriteAccess(req, res, next) {
  if (!req.user?.organization || !isOrganizationAllowed(req.user.organization)) {
    return res.status(402).json({
      message: "Trial expirado ou organizacao inativa. A visualizacao permanece disponivel, mas criacao e edicao estao bloqueadas."
    });
  }

  next();
}
