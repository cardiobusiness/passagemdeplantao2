"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/auth";
import { Organization, User } from "@/lib/types";
import styles from "./signup.module.css";

type SignupForm = {
  organizationName: string;
  organizationDocument: string;
  organizationEmail: string;
  organizationPhone: string;
  name: string;
  cpf: string;
  email: string;
  login: string;
  password: string;
  profession: string;
  council: string;
  registration: string;
  state: string;
};

type SignupResponse = {
  token?: string;
  user?: User;
  organization?: Organization | null;
  message?: string;
};

const initialForm: SignupForm = {
  organizationName: "",
  organizationDocument: "",
  organizationEmail: "",
  organizationPhone: "",
  name: "",
  cpf: "",
  email: "",
  login: "",
  password: "",
  profession: "",
  council: "",
  registration: "",
  state: ""
};

const professionCouncil: Record<string, string> = {
  Fisioterapeuta: "CREFITO",
  Enfermeiro: "COREN",
  Médico: "CRM",
  Nutricionista: "CRN",
  Fonoaudiólogo: "CREFONO",
  Psicólogo: "CRP",
  Outro: ""
};

const professions = [
  { value: "", label: "Selecione a profissão" },
  { value: "Fisioterapeuta", label: "Fisioterapeuta" },
  { value: "Enfermeiro", label: "Enfermeiro" },
  { value: "Médico", label: "Médico" },
  { value: "Nutricionista", label: "Nutricionista" },
  { value: "Fonoaudiólogo", label: "Fonoaudiólogo" },
  { value: "Psicólogo", label: "Psicólogo" },
  { value: "Outro", label: "Outro" }
];

const councilStates = [
  "",
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO"
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupForm>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: keyof SignupForm, value: string) {
    setForm((currentForm) => {
      const nextForm = { ...currentForm, [field]: value };

      if (field === "profession") {
        nextForm.council = professionCouncil[value] ?? "";
      }

      return nextForm;
    });
  }

  async function readResponse(response: Response): Promise<SignupResponse> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("http://localhost:4000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: {
            name: form.organizationName,
            document: form.organizationDocument,
            email: form.organizationEmail,
            phone: form.organizationPhone
          },
          masterUser: {
            name: form.name,
            email: form.email,
            login: form.login,
            password: form.password,
            cpf: form.cpf,
            profession: form.profession,
            professionalCouncil: form.council,
            professionalRegistration: form.registration,
            councilState: form.state
          }
        })
      });
      const signupResponse = await readResponse(response);

      if (!response.ok) {
        throw new Error(signupResponse.message || "Não foi possível criar a conta agora.");
      }

      setSuccess(signupResponse.message || "Conta criada com sucesso. Preparando seu acesso...");

      if (signupResponse.token && signupResponse.user) {
        const sessionUser = signupResponse.organization && !signupResponse.user.organization
          ? { ...signupResponse.user, organization: signupResponse.organization }
          : signupResponse.user;

        saveSession(sessionUser, signupResponse.token);
        window.setTimeout(() => {
          router.replace("/admin/organization");
          router.refresh();
        }, 800);
        return;
      }

      window.setTimeout(() => {
        router.replace("/");
      }, 1000);
    } catch (submitError) {
      console.error("Erro no cadastro:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível criar a conta agora."
      );
      setLoading(false);
    }
  }

  const isOtherProfession = form.profession === "Outro";

  return (
    <main className={styles.wrapper}>
      <div className={`${styles.panel} card`}>
        <section className={styles.hero}>
          <span className="pill">Passagem de Plantão</span>
          <h1>Crie sua conta SaaS</h1>
          <p>Cadastre sua organização, usuário master e comece com 60 dias gratuitos.</p>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <strong>60 dias grátis</strong>
              <span>Periodo trial para validar a rotina da equipe.</span>
            </div>
            <div className={styles.statCard}>
              <strong>Usuário master</strong>
              <span>Administrador inicial com acesso a organização.</span>
            </div>
            <div className={styles.statCard}>
              <strong>Multi-organização</strong>
              <span>Base pronta para operações com mais de uma unidade.</span>
            </div>
          </div>
        </section>

        <section className={styles.formSide}>
          <div className={styles.formHeader}>
            <h2>Criar conta</h2>
            <p>Cadastre a organização e o administrador master.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <section className={styles.formBlock}>
              <h3>Organização</h3>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="organizationName">Nome da organização</label>
                  <input
                    id="organizationName"
                    type="text"
                    value={form.organizationName}
                    onChange={(event) => update("organizationName", event.target.value)}
                    placeholder="Hospital Sao Lucas"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="organizationDocument">CNPJ/documento</label>
                  <input
                    id="organizationDocument"
                    type="text"
                    value={form.organizationDocument}
                    onChange={(event) => update("organizationDocument", event.target.value)}
                    placeholder="00.000.000/0001-00"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="organizationEmail">E-mail institucional</label>
                  <input
                    id="organizationEmail"
                    type="email"
                    value={form.organizationEmail}
                    onChange={(event) => update("organizationEmail", event.target.value)}
                    placeholder="contato@hospital.com"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="organizationPhone">Telefone</label>
                  <input
                    id="organizationPhone"
                    type="tel"
                    value={form.organizationPhone}
                    onChange={(event) => update("organizationPhone", event.target.value)}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>
              </div>
            </section>

            <section className={styles.formBlock}>
              <h3>Usuário administrador</h3>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="name">Nome completo</label>
                  <input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Nome do administrador"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="cpf">CPF</label>
                  <input
                    id="cpf"
                    type="text"
                    value={form.cpf}
                    onChange={(event) => update("cpf", event.target.value)}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="email">E-mail</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="admin@hospital.com"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="login">Login</label>
                  <input
                    id="login"
                    type="text"
                    value={form.login}
                    onChange={(event) => update("login", event.target.value)}
                    placeholder="admin.hospital"
                    required
                  />
                </div>

                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label htmlFor="password">Senha</label>
                  <input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => update("password", event.target.value)}
                    placeholder="Crie uma senha segura"
                    required
                  />
                </div>
              </div>
            </section>

            <section className={styles.formBlock}>
              <h3>Registro profissional</h3>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="profession">Profissão</label>
                  <select
                    id="profession"
                    value={form.profession}
                    onChange={(event) => update("profession", event.target.value)}
                    required
                  >
                    {professions.map((profession) => (
                      <option key={profession.value || "empty"} value={profession.value}>
                        {profession.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="council">Conselho</label>
                  <input
                    id="council"
                    type="text"
                    value={form.council}
                    onChange={(event) => update("council", event.target.value)}
                    placeholder={isOtherProfession ? "Informe o conselho" : "Automático"}
                    readOnly={!isOtherProfession}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="registration">Número do registro</label>
                  <input
                    id="registration"
                    type="text"
                    value={form.registration}
                    onChange={(event) => update("registration", event.target.value)}
                    placeholder="123456"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="state">UF do conselho</label>
                  <select
                    id="state"
                    value={form.state}
                    onChange={(event) => update("state", event.target.value)}
                    required
                  >
                    {councilStates.map((state) => (
                      <option key={state || "empty"} value={state}>
                        {state || "UF"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className={styles.formBlock}>
              <h3>Plano</h3>
              <div className={styles.planBox}>
                <div>
                  <strong>Trial gratuito de 60 dias</strong>
                  <span>Acesso inicial para configurar a organização e testar os fluxos.</span>
                </div>
                <div>
                  <strong>Cobrança futura por usuários ativos</strong>
                  <span>O modelo acompanha o tamanho real da operação.</span>
                </div>
              </div>
            </section>

            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}

            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "Criando conta..." : "Criar conta gratuita"}
            </button>
          </form>

          <Link className={styles.secondaryLink} href="/">
            Já tenho conta. Entrar
          </Link>
        </section>
      </div>
    </main>
  );
}
