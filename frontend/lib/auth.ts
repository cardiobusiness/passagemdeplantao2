import { OrganizationSelectionOption, OrganizationSelectionResponse, User } from "./types";
import { getRoleLabel as getPermissionRoleLabel } from "./permissions";

const USER_STORAGE_KEY = "ctiUser";
const TOKEN_STORAGE_KEY = "ctiToken";
const ORGANIZATION_SELECTION_STORAGE_KEY = "ctiOrganizationSelection";
export const TOKEN_COOKIE_KEY = "ctiToken";

function setSessionCookie(token: string) {
  const secureFlag =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=5184000; SameSite=Lax${secureFlag}`;
}

function clearSessionCookie() {
  document.cookie = `${TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as User;
  } catch {
    clearSession();
    return null;
  }
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function saveSession(user: User, token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(ORGANIZATION_SELECTION_STORAGE_KEY);
  setSessionCookie(token);
}

export function savePendingOrganizationSelection(response: OrganizationSelectionResponse) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ORGANIZATION_SELECTION_STORAGE_KEY, JSON.stringify({
    temporaryToken: response.temporaryToken,
    user: response.user,
    organizations: response.organizations
  }));
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  clearSessionCookie();
}

export function getPendingOrganizationSelection(): {
  temporaryToken: string;
  user: OrganizationSelectionResponse["user"];
  organizations: OrganizationSelectionOption[];
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSelection = window.localStorage.getItem(ORGANIZATION_SELECTION_STORAGE_KEY);

  if (!rawSelection) {
    return null;
  }

  try {
    return JSON.parse(rawSelection);
  } catch {
    clearPendingOrganizationSelection();
    return null;
  }
}

export function clearPendingOrganizationSelection() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ORGANIZATION_SELECTION_STORAGE_KEY);
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ORGANIZATION_SELECTION_STORAGE_KEY);
  clearSessionCookie();
}

export function getRoleLabel(role: string) {
  return getPermissionRoleLabel(role);
}
