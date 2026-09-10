import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, CalendarClock, UserCheck } from "lucide-react";
import { api, ApiError } from "../../lib/api";

interface StatCard {
  label: string;
  value: number | null;
  icon: typeof Package;
  to: string;
}

// Pagina inicial do ADMIN (/admin) - so contagens simples, sem endpoint novo: reusa
// as mesmas listas que Materiais/Horarios/Aprovacoes ja consomem e conta no cliente
// (.length), como pedido - nenhuma agregacao no backend so para isto.
export function Dashboard() {
  const [activeMaterials, setActiveMaterials] = useState<number | null>(null);
  const [activeClassPeriods, setActiveClassPeriods] = useState<number | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<unknown[]>("/materials", { active: true })
      .then((data) => setActiveMaterials(data.length))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar os dados."));

    api
      .get<unknown[]>("/class-periods", { active: true })
      .then((data) => setActiveClassPeriods(data.length))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar os dados."));

    api
      .get<unknown[]>("/auth/professors/pending")
      .then((data) => setPendingApprovals(data.length))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar os dados."));
  }, []);

  const cards: StatCard[] = [
    { label: "Materiais ativos", value: activeMaterials, icon: Package, to: "/admin/materiais" },
    { label: "Horarios ativos", value: activeClassPeriods, icon: CalendarClock, to: "/admin/horarios" },
    { label: "Aprovacoes pendentes", value: pendingApprovals, icon: UserCheck, to: "/admin/aprovacoes" },
  ];

  return (
    <div>
      <h1>Painel</h1>
      <p className="text-muted">Visao geral do Armario Digital.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cards.map(({ label, value, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--color-text)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "var(--radius-sm)",
                background: "var(--color-accent-100)",
                color: "var(--color-accent-700)",
                flexShrink: 0,
              }}
            >
              <Icon size={20} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{value ?? "..."}</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
