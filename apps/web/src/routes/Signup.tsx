import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useTenantPath } from "../lib/tenantPath";
import { Header } from "../components/Header";

// Cadastro publico do Professor - sempre PENDING (ver auth.service.ts no backend).
// Nunca loga automaticamente: so mostra a confirmacao e manda para o login, onde a
// tentativa de entrar antes da aprovacao mostra a mensagem "aguardando aprovacao".
export function Signup() {
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/signup", { name, email, phone, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel enviar o cadastro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="page-shell">
        <Header />
        <div className="app-main" style={{ paddingTop: "10vh" }}>
          <h1>Cadastro enviado</h1>
          <p className="text-muted">
            Seu cadastro foi enviado para a coordenacao. Voce vai poder entrar assim que ele for aprovado.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate(tenantPath("/login"))}>
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Header />
      <div className="app-main" style={{ paddingTop: "4vh" }}>
      <h1>Cadastro de professor</h1>
      <p className="text-muted">Seu acesso precisa ser aprovado pela coordenacao antes do primeiro login.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="phone">WhatsApp</label>
          <input
            id="phone"
            className="input"
            type="tel"
            required
            minLength={8}
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Usado para negociar horarios com outros professores quando necessario.
          </p>
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar cadastro"}
        </button>
      </form>

      <p className="text-muted" style={{ marginTop: 20, fontSize: 13 }}>
        Ja tem cadastro aprovado? <Link to={tenantPath("/login")}>Entrar</Link>
      </p>
      </div>
    </div>
  );
}
