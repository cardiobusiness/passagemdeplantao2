"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login-form.module.css";
import { savePendingOrganizationSelection, saveSession } from "@/lib/auth";
import { login } from "@/lib/api";
import { getDefaultRouteForRole } from "@/lib/permissions";
import { LoginResponse, OrganizationSelectionResponse } from "@/lib/types";

function requiresOrganizationSelection(response: LoginResponse): response is OrganizationSelectionResponse {
  return "requiresOrganizationSelection" in response && response.requiresOrganizationSelection;
}

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await login(identifier, password);

      if (requiresOrganizationSelection(response)) {
        savePendingOrganizationSelection(response);
        router.replace("/select-organization");
        return;
      }

      saveSession(response.user, response.token);
      router.replace(getDefaultRouteForRole(response.user.role));
      router.refresh();
    } catch (submitError) {
      console.error("Erro no login:", submitError);
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.wrapper}>
      <div className={`${styles.panel} card`}>
        <section className={styles.hero}>
          <span className="pill">Passagem de Plantao</span>
          <h1>Gestão Inteligente de CTI</h1>
          <p>
            Acesse o mapa de leitos, a ficha completa do paciente, os analytics e a administracao
            de profissionais com controle de perfis em uma experiencia unica e responsiva.
          </p>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <strong>40</strong>
              <span>Leitos mapeados</span>
            </div>
            <div className={styles.statCard}>
              <strong>4</strong>
              <span>Perfis de acesso</span>
            </div>
            <div className={styles.statCard}>
              <strong>24h</strong>
              <span>Acesso web e mobile</span>
            </div>
          </div>
        </section>

        <section className={styles.formSide}>
          <h2>Entrar</h2>
          <p>Use login ou e-mail e uma senha valida para entrar no sistema.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="identifier">Login ou e-mail</label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="******"
                required
              />
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Acessar painel"}
            </button>
          </form>

          <div className={styles.credentials}>
            Admin inicial: `admin` / `Admin@123`
            <br />
            Coordenador: `coordenador` / `Coord@123`
            <br />
            Rotina: `rotina` / `Rotina@123`
            <br />
            Plantonista: `plantonista` / `Plantao@123`
          </div>
        </section>
      </div>
    </main>
  );
}
