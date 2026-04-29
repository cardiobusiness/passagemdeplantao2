import { cookies } from "next/headers";
import {
  getBeds,
  getMe,
  getMonthlyDashboard,
  getPatient,
  getPatients
} from "./api";
import { Bed, DashboardSummary, Patient, User } from "./types";
import { TOKEN_COOKIE_KEY } from "./auth";

export const emptyDashboard: DashboardSummary = {
  month: "Sem dados",
  occupancyRate: 0,
  activeAlerts: 0,
  respiratoryEvolutions: 0,
  motorEvolutions: 0,
  averageLengthOfStay: 0,
  averageAdmissionAge: 0,
  originStats: [],
  averageAgeByOrigin: [],
  examsRegistered: 0,
  metrics: {
    totalBeds: 0,
    occupiedBeds: 0,
    totalPatients: 0,
    admissionsThisMonth: 0
  }
};

function getServerToken() {
  return cookies().get(TOKEN_COOKIE_KEY)?.value ?? null;
}

export async function getServerBeds(): Promise<Bed[]> {
  const token = getServerToken();
  return token ? getBeds(token) : [];
}

export async function getServerCurrentUser(): Promise<User | null> {
  const token = getServerToken();
  return token ? getMe(token) : null;
}

export async function getServerPatients(): Promise<Patient[]> {
  const token = getServerToken();
  return token ? getPatients(token) : [];
}

export async function getServerPatient(patientId: number): Promise<Patient> {
  const token = getServerToken();

  if (!token) {
    throw new Error("Sessao nao encontrada.");
  }

  return getPatient(patientId, token);
}

export async function getServerMonthlyDashboard(): Promise<DashboardSummary> {
  const token = getServerToken();
  return token ? getMonthlyDashboard(token) : emptyDashboard;
}
