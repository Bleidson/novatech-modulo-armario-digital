import { useState, type FormEvent } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Header } from "../components/Header";
import { useTenantPath } from "../lib/tenantPath";

export function Login() {
  const { login, user, status } = useAuth();
  const location = useLocation();
  const tenantPath = useTenantPath();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user) {
    const from = (location.state as { from?: Location })?.from;
    const fallback = tenantPath(user.role === "ADMIN" ? "/admin" : "/professor");
    return <Navigate to={from?.pathname ?? fallback} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel entrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <Header />
      <div className="app-main" style={{ paddingTop: "10vh" }}>
      <h1>Armario Digital</h1>
      <p className="text-muted">Entre com seu e-mail e senha.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-muted" style={{ marginTop: 20, fontSize: 13 }}>
        Ainda nao tem cadastro? <Link to={tenantPath("/cadastro")}>Cadastre-se como professor</Link>
      </p>
      </div>
    </div>
  );
}
