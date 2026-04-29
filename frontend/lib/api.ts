import {
  Bed,
  BedFormPayload,
  CreatePatientLabPayload,
  CreatePatientPayload,
  AuthenticatedLoginResponse,
  DashboardSummary,
  DischargePatientPayload,
  Handover,
  LoginResponse,
  Organization,
  ResetPasswordPayload,
  Patient,
  PatientLab,
  Sector,
  SectorFormPayload,
  UpdatePatientClinicalPayload,
  UpdateOrganizationPayload,
  UpdateUserPayload,
  User,
  UserFormPayload
} from "./types";
import { getStoredToken } from "./auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://passagemdeplantao.eletrostarsoft.com.br/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {})
      },
      cache: "no-store"
    });
  } catch {
    throw new Error("Falha de conexao com o backend. Verifique a API, a URL configurada e o CORS.");
  }

  if (!response.ok) {
    let message = `Erro na requisicao: ${response.status}`;

    try {
      const errorPayload = await response.json();

      if (errorPayload?.message) {
        message = errorPayload.message;
      }
    } catch {
      // Keep the fallback message when the backend does not return JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function withAuthorization(token?: string | null, options?: RequestInit): RequestInit {
  const resolvedToken = token ?? getStoredToken();

  return {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {})
    }
  };
}

export function login(identifier: string, password: string) {
  const loginUrl = `${apiUrl}/auth/login`;

  console.log("Login API:", loginUrl);

  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password })
  });
}

export function selectOrganization(temporaryToken: string, organizationId: number) {
  return request<AuthenticatedLoginResponse>("/auth/select-organization", {
    method: "POST",
    body: JSON.stringify({ temporaryToken, organizationId })
  });
}

export function logout(token: string) {
  return request<void>("/auth/logout", withAuthorization(token, { method: "POST" }));
}

export function getMe(token: string) {
  return request<User>("/auth/me", withAuthorization(token));
}

export function getActiveProfessionals(token: string) {
  return request<User[]>("/auth/professionals", withAuthorization(token));
}

export function getBeds(token?: string | null) {
  return request<Bed[]>("/beds", withAuthorization(token));
}

export function getAdminBeds(token: string) {
  return request<Bed[]>("/beds/admin", withAuthorization(token));
}

export function createAdminBed(token: string, payload: BedFormPayload) {
  return request<Bed>("/beds/admin", withAuthorization(token, {
    method: "POST",
    body: JSON.stringify(payload)
  }));
}

export function updateAdminBed(token: string, bedId: number, payload: Partial<BedFormPayload>) {
  return request<Bed>(`/beds/admin/${bedId}`, withAuthorization(token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }));
}

export function getPatients(token?: string | null) {
  return request<Patient[]>("/patients", withAuthorization(token));
}

export function getPatient(patientId: number, token?: string | null) {
  return request<Patient>(`/patients/${patientId}`, withAuthorization(token));
}

export function createPatient(payload: CreatePatientPayload, token?: string | null) {
  return request<Patient>("/patients", withAuthorization(token, {
    method: "POST",
    body: JSON.stringify(payload)
  }));
}

export function updatePatientClinicalData(patientId: number, payload: UpdatePatientClinicalPayload, token?: string | null) {
  return request<Patient>(`/patients/${patientId}/clinical-data`, withAuthorization(token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }));
}

export function getPatientLabs(patientId: number, token?: string | null) {
  return request<PatientLab[]>(`/patients/${patientId}/labs`, withAuthorization(token));
}

export function createPatientLab(patientId: number, payload: CreatePatientLabPayload, token?: string | null) {
  return request<PatientLab>(`/patients/${patientId}/labs`, withAuthorization(token, {
    method: "POST",
    body: JSON.stringify(payload)
  }));
}

export function updatePatientLab(patientId: number, labId: number, payload: CreatePatientLabPayload, token?: string | null) {
  return request<PatientLab>(`/patients/${patientId}/labs/${labId}`, withAuthorization(token, {
    method: "PUT",
    body: JSON.stringify(payload)
  }));
}

export function deletePatientLab(patientId: number, labId: number, token?: string | null) {
  return request<PatientLab>(`/patients/${patientId}/labs/${labId}`, withAuthorization(token, {
    method: "DELETE"
  }));
}

export function dischargePatient(patientId: number, payload: DischargePatientPayload, token?: string | null) {
  return request<Patient>(`/patients/${patientId}/discharge`, withAuthorization(token, {
    method: "POST",
    body: JSON.stringify(payload)
  }));
}

export function getMonthlyDashboard(token?: string | null) {
  return request<DashboardSummary>("/dashboard/monthly", withAuthorization(token));
}

export function getOrganizationMe(token: string) {
  return request<Organization>("/organization/me", withAuthorization(token));
}

export function updateOrganizationMe(token: string, payload: UpdateOrganizationPayload) {
  return request<Organization>("/organization/me", withAuthorization(token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }));
}

export function getSectors(token: string) {
  return request<Sector[]>("/sectors", withAuthorization(token));
}

export function createSector(token: string, payload: SectorFormPayload) {
  return request<Sector>("/sectors", withAuthorization(token, {
    method: "POST",
    body: JSON.stringify(payload)
  }));
}

export function updateSector(token: string, sectorId: number, payload: Partial<SectorFormPayload>) {
  return request<Sector>(`/sectors/${sectorId}`, withAuthorization(token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }));
}

export function getAdminUsers(token: string) {
  return request<User[]>("/admin/users", withAuthorization(token));
}

export function createAdminUser(token: string, payload: UserFormPayload) {
  return request<User>("/admin/users", withAuthorization(token, {
    method: "POST",
    body: JSON.stringify(payload)
  }));
}

export function updateAdminUser(token: string, userId: number, payload: UpdateUserPayload) {
  return request<User>(`/admin/users/${userId}`, withAuthorization(token, {
    method: "PUT",
    body: JSON.stringify(payload)
  }));
}

export function updateAdminUserStatus(token: string, userId: number, isActive: boolean) {
  return request<User>(`/admin/users/${userId}/status`, withAuthorization(token, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  }));
}

export function resetAdminUserPassword(token: string, userId: number, payload: ResetPasswordPayload) {
  return request<User>(`/admin/users/${userId}/reset-password`, withAuthorization(token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }));
}

export function getHandovers(token: string) {
  return request<Handover[]>("/handovers", withAuthorization(token));
}

export function createHandover(token: string, professionalId: number, bedIds: number[]) {
  return request<Handover>("/handovers", withAuthorization(token, {
    method: "POST",
    body: JSON.stringify({ professionalId, bedIds })
  }));
}
