import Link from "next/link";
import { BedGrid } from "@/components/BedGrid";
import { PatientDischargeCard } from "@/components/PatientDischargeCard";
import { PatientForm } from "@/components/PatientForm";
import { PatientHistoryCard } from "@/components/PatientHistoryCard";
import { PatientLabsModule } from "@/components/PatientLabsModule";
import { ProtectedShell } from "@/components/ProtectedShell";
import {
  emptyDashboard,
  getServerBeds,
  getServerCurrentUser,
  getServerMonthlyDashboard,
  getServerPatients
} from "@/lib/server-api";
import { Bed, DashboardSummary, Patient, User } from "@/lib/types";
import { formatVentilatorySupport } from "@/lib/ventilatorySupport";
import styles from "@/components/dashboard-shell.module.css";

type Props = {
  searchParams?: {
    patientId?: string;
  };
};

async function loadDashboardData() {
  const results = await Promise.allSettled([
    getServerCurrentUser(),
    getServerBeds(),
    getServerMonthlyDashboard(),
    getServerPatients()
  ]);
  const [userResult, bedsResult, dashboardResult, patientsResult] = results;
  const errors: string[] = [];

  const currentUser: User | null = userResult.status === "fulfilled" ? userResult.value : null;

  const beds: Bed[] = bedsResult.status === "fulfilled" ? bedsResult.value : [];
  if (bedsResult.status === "rejected") {
    errors.push("Nao foi possivel carregar o mapa de leitos.");
  }

  const dashboard: DashboardSummary =
    dashboardResult.status === "fulfilled" && dashboardResult.value
      ? dashboardResult.value
      : emptyDashboard;
  if (dashboardResult.status === "rejected") {
    errors.push("Nao foi possivel carregar o resumo mensal.");
  }

  const patients: Patient[] = patientsResult.status === "fulfilled" ? patientsResult.value : [];
  if (patientsResult.status === "rejected") {
    errors.push("Nao foi possivel carregar os pacientes.");
  }

  return { beds, dashboard, patients, currentUser, errors };
}

export default async function DashboardPage({ searchParams }: Props) {
  const { beds, dashboard, patients, currentUser, errors } = await loadDashboardData();
  const hasPatients = patients.length > 0;
  const hasSectorAccess = Boolean(currentUser?.sectorIds?.length);

  const availableBeds = beds
    .filter((bed) => !bed.occupied)
    .map((bed) => ({ id: bed.id, code: bed.code }));
  const activePatients = patients.filter((patient) => patient.bedId !== null);
  const queryPatientId = Number(searchParams?.patientId);
  const initialPatientId =
    Number.isInteger(queryPatientId) && patients.some((patient) => patient.id === queryPatientId)
      ? queryPatientId
      : null;
  const highlightedAlerts = activePatients
    .filter((patient) => patient.alerts.length > 0)
    .slice(0, 4);

  return (
    <ProtectedShell routeKey="dashboard">
      <section className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className="pill">{dashboard.month}</span>
            <h1>Passagem de Plantao</h1>
            <p>
              Gestao Inteligente de CTI com monitoramento integrado dos 40 leitos,
              fluxo assistencial, exames e alertas de condutas prioritarias.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.primaryButton} href="/patients/new">
              Novo paciente
            </Link>
          </div>
        </header>

        {errors.length ? (
          <section className={`${styles.section} card`}>
            <div className={styles.sectionHeader}>
              <h2>Carregamento parcial</h2>
            </div>
            <p className={styles.empty}>
              Algumas informacoes nao puderam ser carregadas agora. A pagina segue disponivel.
            </p>
            <div className={styles.list}>
              {errors.map((error) => (
                <p key={error} className={styles.empty}>
                  {error}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.summaryGrid}>
          <article className={`${styles.summaryCard} card`}>
            <span>Taxa de ocupacao</span>
            <strong>{dashboard.occupancyRate}%</strong>
            <small>{dashboard.metrics?.totalBeds ?? beds.length} leitos monitorados</small>
          </article>
          <article className={`${styles.summaryCard} card`}>
            <span>Alertas ativos</span>
            <strong>{dashboard.activeAlerts}</strong>
            <small>Prioridades automaticas</small>
          </article>
          <article className={`${styles.summaryCard} card`}>
            <span>Evolucoes do mes</span>
            <strong>{dashboard.respiratoryEvolutions + dashboard.motorEvolutions}</strong>
            <small>
              Respiratoria {dashboard.respiratoryEvolutions} | Motora {dashboard.motorEvolutions}
            </small>
          </article>
        </section>

        <div className={styles.grid}>
          <section className={`${styles.section} card`}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Mapa de leitos</h2>
                <span className="pill">Atualizacao em tempo real preparada</span>
              </div>
            </div>
            <BedGrid beds={beds} hasSectorAccess={hasSectorAccess} />
          </section>

          <div className={styles.rightColumn}>
            <PatientForm availableBeds={availableBeds} />

            {!hasPatients ? (
              <section className={`${styles.section} card`}>
                <div className={styles.sectionHeader}>
                  <h2>Nenhum paciente internado</h2>
                </div>
                <p className={styles.empty}>
                  Os leitos estao disponiveis. Cadastre um novo paciente para liberar alta, exames e historico.
                </p>
              </section>
            ) : (
              <>
                <PatientDischargeCard patients={patients} initialPatientId={initialPatientId} />
                <PatientLabsModule patients={activePatients} initialPatientId={initialPatientId} />
              </>
            )}

            <section className={`${styles.section} card`}>
              <div className={styles.sectionHeader}>
                <h2>Alertas prioritarios</h2>
              </div>
              <div className={styles.list}>
                {highlightedAlerts.length ? (
                  highlightedAlerts.map((patient) => (
                    <article key={patient.id} className={styles.listItem}>
                      <strong>{patient.name}</strong>
                      <p>{patient.alerts[0]}</p>
                      <div className={styles.statusRow}>
                        <span>{patient.bedCode ?? "Sem leito ativo"}</span>
                        <span>{formatVentilatorySupport(patient.ventilatorySupport)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className={styles.empty}>Nenhum alerta critico neste momento.</p>
                )}
              </div>
            </section>

            {hasPatients ? (
              <PatientHistoryCard patients={patients} />
            ) : (
              <section className={`${styles.section} card`}>
                <div className={styles.sectionHeader}>
                  <h2>Historico recente</h2>
                </div>
                <p className={styles.empty}>Nenhum historico disponivel enquanto nao houver pacientes cadastrados.</p>
              </section>
            )}
          </div>
        </div>
      </section>
    </ProtectedShell>
  );
}
