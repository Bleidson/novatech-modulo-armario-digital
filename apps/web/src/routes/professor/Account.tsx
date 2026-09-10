import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarCheck2, CalendarClock, History, Save } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

interface ReservationSummary {
  id: string;
  date: string;
}

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Pagina "Conta" do professor - dados pessoais editaveis (nome, WhatsApp) com um
// unico botao "Salvar" geral, e um resumo de atividade calculado a partir das
// proprias reservas (GET /reservations sem filtro de data ja devolve todas as
// do professor, passadas e futuras - reaproveitado aqui em vez de um endpoint
// novo so para contagem).
export function Account() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [reservations, setReservations] = useState<ReservationSummary[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = useCallback(() => {
    api
      .get<ReservationSummary[]>("/reservations")
      .then(setReservations)
      .catch((err) => setSummaryError(err instanceof ApiError ? err.message : "Nao foi possivel carregar o resumo."));
  }, []);

  useEffect(loadSummary, [loadSummary]);

  const todayISO = useMemo(todayISODate, []);
  const activity = useMemo(() => {
    if (!reservations) return null;
    const upcoming = reservations.filter((r) => r.date.slice(0, 10) >= todayISO).length;
    const past = reservations.length - upcoming;
    return { total: reservations.length, upcoming, past };
  }, [reservations, todayISO]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.patch("/auth/me", { name, phone });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel salvar seus dados.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Conta</h1>
      <p className="text-muted">Seus dados pessoais e um resumo da sua atividade no Armario Digital.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Dados pessoais</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {saved && <div className="alert alert-success">Dados salvos com sucesso.</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="account-name">Nome</label>
            <input id="account-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="account-email">E-mail</label>
            <input id="account-email" className="input" value={user?.email ?? ""} disabled />
            <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              O e-mail nao pode ser alterado por aqui.
            </p>
          </div>
          <div className="field">
            <label htmlFor="account-phone">WhatsApp</label>
            <input
              id="account-phone"
              className="input"
              type="tel"
              required
              minLength={8}
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Usado para negociar horarios com outros professores.
            </p>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            <Save size={16} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Resumo de atividade</h3>
        {summaryError && <div className="alert alert-error">{summaryError}</div>}
        {!activity && !summaryError && <p className="text-muted">Carregando...</p>}
        {activity && (
          <div className="activity-summary">
            <div className="activity-stat">
              <CalendarClock size={18} />
              <div>
                <strong>{activity.upcoming}</strong>
                <span>Reservas futuras</span>
              </div>
            </div>
            <div className="activity-stat">
              <History size={18} />
              <div>
                <strong>{activity.past}</strong>
                <span>Reservas passadas</span>
              </div>
            </div>
            <div className="activity-stat">
              <CalendarCheck2 size={18} />
              <div>
                <strong>{activity.total}</strong>
                <span>Total de reservas</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
