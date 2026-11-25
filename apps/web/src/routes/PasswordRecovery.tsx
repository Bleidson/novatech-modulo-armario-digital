import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { api, ApiError } from "../lib/api";
import { useTenantPath } from "../lib/tenantPath";

export function PasswordRecovery({ mode }: { mode: "request" | "confirm" }) {
  const tenantPath = useTenantPath();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (mode === "confirm") {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (value) { setToken(value); window.history.replaceState(window.history.state, "", window.location.pathname); }
    }
  }, [mode]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (mode === "confirm" && password !== confirmation) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      const result = await api.post<{ message: string }>(`/auth/password-recovery/${mode}`, mode === "request" ? { email } : { token, password });
      setPassword(""); setConfirmation(""); setMessage(result.message);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Não foi possível conectar. Tente novamente."); } finally { setLoading(false); }
  }
  return <div className="page-shell"><Header /><main className="app-main" style={{ paddingTop: "10vh" }}>
    <h1>{mode === "request" ? "Recuperar senha" : "Redefinir senha"}</h1>
    {message ? <p role="status">{message}</p> : <form onSubmit={submit}>
      {mode === "request" ? <div className="field"><label htmlFor="recovery-email">E-mail</label><input className="input" id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div> : <>
        <div className="field"><label htmlFor="new-password">Nova senha</label><input className="input" id="new-password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="field"><label htmlFor="confirm-password">Confirmar senha</label><input className="input" id="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
        <label><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Mostrar senhas</label>
      </>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {mode === "confirm" && !token && <p role="alert">Link inválido. Solicite um novo link.</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={loading || (mode === "confirm" && !token)}>{loading ? "Aguarde..." : mode === "request" ? "Enviar link de recuperação" : "Salvar nova senha"}</button>
    </form>}
    <p><Link to={tenantPath("/login")}>Voltar ao login</Link></p>
  </main></div>;
}
