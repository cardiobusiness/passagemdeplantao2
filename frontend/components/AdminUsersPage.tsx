"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  createAdminUser,
  getAdminUsers,
  getSectors,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus
} from "@/lib/api";
import { getRoleLabel, getStoredToken } from "@/lib/auth";
import { Sector, UpdateUserPayload, User, UserFormPayload } from "@/lib/types";
import { AdminNav } from "./AdminNav";
import styles from "./admin-users-page.module.css";

const initialFormState: UserFormPayload = {
  name: "",
  email: "",
  login: "",
  password: "",
  jobTitle: "",
  role: "routine",
  isActive: true,
  sectorIds: []
};

const roleOptions = [
  { value: "administrator", label: "Administrador" },
  { value: "coordinator", label: "Coordenador" },
  { value: "routine", label: "Rotina" },
  { value: "oncall", label: "Plantonista" }
];

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [form, setForm] = useState<UserFormPayload>(initialFormState);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  function getDefaultSectorIds(source = sectors) {
    return source.filter((sector) => sector.isActive).map((sector) => sector.id);
  }

  async function loadUsers() {
    const token = getStoredToken();

    if (!token) {
      setError("Sessao nao encontrada.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [nextUsers, nextSectors] = await Promise.all([
        getAdminUsers(token),
        getSectors(token)
      ]);
      setUsers(nextUsers);
      setSectors(nextSectors);
      setForm((current) => ({
        ...current,
        sectorIds: editingUserId ? current.sectorIds : current.sectorIds.length ? current.sectorIds : getDefaultSectorIds(nextSectors)
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar os usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleChange(field: keyof UserFormPayload, value: string | boolean | number[]) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleSectorToggle(sectorId: number, checked: boolean) {
    setForm((current) => ({
      ...current,
      sectorIds: checked
        ? [...new Set([...current.sectorIds, sectorId])]
        : current.sectorIds.filter((currentSectorId) => currentSectorId !== sectorId)
    }));
  }

  function startEdit(user: User) {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      login: user.login,
      password: "",
      jobTitle: user.jobTitle,
      role: user.role,
      isActive: user.isActive,
      sectorIds: user.sectorIds ?? user.sectors?.map((sector) => sector.id) ?? []
    });
    setFeedback("");
    setError("");
  }

  function resetForm() {
    setEditingUserId(null);
    setForm({
      ...initialFormState,
      sectorIds: getDefaultSectorIds()
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredToken();

    if (!token) {
      setError("Sessao nao encontrada.");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    setError("");

    try {
      if (form.sectorIds.length === 0) {
        throw new Error("Selecione pelo menos um setor para o profissional.");
      }

      if (editingUserId) {
        const payload: UpdateUserPayload = {
          name: form.name,
          email: form.email,
          login: form.login,
          jobTitle: form.jobTitle,
          role: form.role,
          isActive: form.isActive,
          sectorIds: form.sectorIds
        };

        await updateAdminUser(token, editingUserId, payload);
        setFeedback("Profissional atualizado com sucesso.");
      } else {
        await createAdminUser(token, form);
        setFeedback("Profissional cadastrado com sucesso.");
      }

      resetForm();
      await loadUsers();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel salvar o profissional.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(user: User) {
    const token = getStoredToken();

    if (!token) {
      setError("Sessao nao encontrada.");
      return;
    }

    setFeedback("");
    setError("");

    try {
      await updateAdminUserStatus(token, user.id, !user.isActive);
      setFeedback(`Profissional ${!user.isActive ? "ativado" : "inativado"} com sucesso.`);
      await loadUsers();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Nao foi possivel atualizar o status.");
    }
  }

  async function handleResetPassword(user: User) {
    const token = getStoredToken();

    if (!token) {
      setError("Sessao nao encontrada.");
      return;
    }

    const nextPassword = window.prompt(`Informe a nova senha para ${user.name}:`, "");

    if (!nextPassword) {
      return;
    }

    setFeedback("");
    setError("");

    try {
      await resetAdminUserPassword(token, user.id, { password: nextPassword });
      setFeedback("Senha redefinida com sucesso.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Nao foi possivel redefinir a senha.");
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className="pill">Area restrita</span>
          <h1>Administracao de Usuarios</h1>
          <p>Passagem de Plantao | Gestao Inteligente de CTI para cadastro e controle da equipe.</p>
        </div>
      </header>

      <AdminNav />

      <div className={styles.grid}>
        <section className={`${styles.panel} card`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{editingUserId ? "Editar profissional" : "Novo profissional"}</h2>
              <p>Administradores e rotina podem cadastrar, editar e manter os profissionais ativos.</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Nome completo</span>
              <input value={form.name} onChange={(event) => handleChange("name", event.target.value)} required />
            </label>

            <label className={styles.field}>
              <span>E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Login</span>
              <input value={form.login} onChange={(event) => handleChange("login", event.target.value)} required />
            </label>

            <label className={styles.field}>
              <span>{editingUserId ? "Senha (mantida no backend ao editar)" : "Senha inicial (obrigatoria para novo usuario)"}</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Cargo / funcao</span>
              <input
                value={form.jobTitle}
                onChange={(event) => handleChange("jobTitle", event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Perfil de acesso</span>
              <select value={form.role} onChange={(event) => handleChange("role", event.target.value)}>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => handleChange("isActive", event.target.checked)}
              />
              <span>Usuario ativo</span>
            </label>

            <fieldset className={styles.sectorAccess}>
              <legend>Setores liberados</legend>
              <div className={styles.sectorGrid}>
                {sectors.map((sector) => (
                  <label key={sector.id} className={styles.sectorOption}>
                    <input
                      type="checkbox"
                      checked={form.sectorIds.includes(sector.id)}
                      onChange={(event) => handleSectorToggle(sector.id, event.target.checked)}
                    />
                    <span>{sector.name}{sector.isActive ? "" : " (inativo)"}</span>
                  </label>
                ))}
              </div>
              {!loading && sectors.length === 0 ? (
                <p className={styles.empty}>Cadastre um setor antes de liberar acessos.</p>
              ) : null}
            </fieldset>

            {feedback ? <p className={styles.success}>{feedback}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : editingUserId ? "Salvar alteracoes" : "Cadastrar profissional"}
              </button>
              {editingUserId ? (
                <button className={styles.secondaryButton} type="button" onClick={resetForm}>
                  Cancelar edicao
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className={`${styles.panel} card`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Profissionais cadastrados</h2>
              <p>{users.length} profissionais cadastrados.</p>
            </div>
          </div>

          {loading ? <p className={styles.empty}>Carregando usuarios...</p> : null}

          <div className={styles.list}>
            {users.map((user) => (
              <article key={user.id} className={styles.userCard}>
                <div className={styles.userHeading}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>
                      {getRoleLabel(user.role)} | {user.jobTitle}
                    </span>
                  </div>
                  <span className={user.isActive ? styles.activeBadge : styles.inactiveBadge}>
                    {user.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className={styles.userMeta}>
                  <span>E-mail: {user.email}</span>
                  <span>Login: {user.login}</span>
                  <span>
                    Setores:{" "}
                    {user.sectors?.length
                      ? user.sectors.map((sector) => sector.name).join(", ")
                      : "Nenhum setor liberado para este usuário."}
                  </span>
                </div>

                <div className={styles.cardActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => startEdit(user)}>
                    Editar
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => handleToggleStatus(user)}>
                    {user.isActive ? "Inativar" : "Ativar"}
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={() => handleResetPassword(user)}>
                    Redefinir senha
                  </button>
                </div>
              </article>
            ))}

            {!loading && users.length === 0 ? (
              <p className={styles.empty}>Nenhum profissional cadastrado.</p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
