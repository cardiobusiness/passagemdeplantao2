"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { selectOrganization } from "@/lib/api";
import {
  clearPendingOrganizationSelection,
  getPendingOrganizationSelection,
  saveSession
} from "@/lib/auth";
import { getDefaultRouteForRole, getRoleLabel } from "@/lib/permissions";
import { OrganizationSelectionOption } from "@/lib/types";
import styles from "./select-organization-page.module.css";

type PendingSelection = {
  temporaryToken: string;
  user: {
    id: number;
    name: string;
    email: string;
    login: string;
    isActive: boolean;
  };
  organizations: OrganizationSelectionOption[];
};

function getPlanSummary(organization: OrganizationSelectionOption) {
  if (organization.status === "trial") {
    const days = organization.trialDaysRemaining ?? 0;
    return `Trial: ${days} ${days === 1 ? "dia restante" : "dias restantes"}`;
  }

  return `Plano ${organization.plan} | ${organization.status}`;
}

export function SelectOrganizationPage() {
  const router = useRouter();
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [submittingOrganizationId, setSubmittingOrganizationId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const selection = getPendingOrganizationSelection();

    if (!selection) {
      router.replace("/");
      return;
    }

    setPendingSelection(selection);
  }, [router]);

  async function handleSelectOrganization(organizationId: number) {
    if (!pendingSelection || submittingOrganizationId) {
      return;
    }

    setSubmittingOrganizationId(organizationId);
    setError("");

    try {
      const response = await selectOrganization(pendingSelection.temporaryToken, organizationId);
      saveSession(response.user, response.token);
      clearPendingOrganizationSelection();
      router.replace(getDefaultRouteForRole(response.user.role));
      router.refresh();
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Nao foi possivel acessar a organizacao.");
    } finally {
      setSubmittingOrganizationId(null);
    }
  }

  if (!pendingSelection) {
    return (
      <main className={styles.page}>
        <section className={`${styles.panel} card`}>Carregando organizacoes...</section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={`${styles.panel} card`}>
        <header className={styles.header}>
          <span className="pill">Selecao de organizacao</span>
          <h1>Escolha onde deseja acessar</h1>
          <p>{pendingSelection.user.name}</p>
        </header>

        <div className={styles.organizationList}>
          {pendingSelection.organizations.map((organization) => (
            <article key={organization.id} className={styles.organizationCard}>
              <div>
                <h2>{organization.name}</h2>
                <p>{getRoleLabel(organization.role)} | {organization.jobTitle || "Funcao nao informada"}</p>
                <span>{getPlanSummary(organization)}</span>
              </div>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => handleSelectOrganization(organization.id)}
                disabled={submittingOrganizationId !== null}
              >
                {submittingOrganizationId === organization.id ? "Acessando..." : "Acessar organizacao"}
              </button>
            </article>
          ))}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}
