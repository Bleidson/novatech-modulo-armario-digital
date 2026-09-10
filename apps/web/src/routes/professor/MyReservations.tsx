import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarX2, MessageCircle } from "lucide-react";
import { api, ApiError } from "../../lib/api";

interface Reservation {
  id: string;
  date: string;
  material: { id: string; name: string };
  classPeriod: { id: string; name: string };
}

interface TenantHealth {
  phone: string | null;
}

function formatDateLabel(isoDate: string): string {
  // isoDate vem da API como "AAAA-MM-DDT00:00:00.000Z" (coluna @db.Date) - corta
  // pra so a parte da data e reconstroi em horario LOCAL (meio-dia, nunca meia-
  // noite) pra nunca cair no dia anterior por causa de fuso.
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const local = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
  const label = local.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// wa.me so aceita digitos (codigo do pais + DDD + numero) - qualquer formatacao
// humana (parenteses, traco, espaco) precisa ser removida antes de montar o link.
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Agenda pessoal do professor: proprias reservas (GET /reservations sem ?date ja
// devolve so as dele, ver reservations.service.ts - PROFESSOR nunca ve as de
// outro), agrupadas por dia. Cancelar pede confirmacao (acao irreversivel: cancelar
// = apagar a linha, nao um soft-cancel, ver schema.prisma).
export function MyReservations() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Reservation[]>("/reservations")
      .then(setReservations)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar suas reservas."),
      );
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    api
      .get<TenantHealth>("/health/tenant")
      .then((data) => setPhone(data.phone))
      .catch(() => setPhone(null));
  }, []);

  async function handleCancel(reservation: Reservation) {
    const confirmed = window.confirm(
      `Cancelar a reserva de "${reservation.material.name}" (${reservation.classPeriod.name}) em ${formatDateLabel(reservation.date)}?`,
    );
    if (!confirmed) return;

    setBusyId(reservation.id);
    setError(null);
    try {
      await api.delete(`/reservations/${reservation.id}`);
      setReservations((prev) => prev?.filter((r) => r.id !== reservation.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel cancelar esta reserva.");
    } finally {
      setBusyId(null);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations ?? []) {
      const key = r.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [reservations]);

  const whatsappHref = useMemo(() => {
    if (!phone) return null;
    const digits = digitsOnly(phone);
    if (!digits) return null;
    const message = "Ola! Preciso falar sobre uma reserva no Armario Digital.";
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }, [phone]);

  return (
    <div>
      <h1>Minhas reservas</h1>
      <p className="text-muted">Suas proximas reservas, agrupadas por dia.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary btn-block"
          style={{ marginBottom: 16 }}
        >
          <MessageCircle size={16} /> Falar com a coordenacao pelo WhatsApp
        </a>
      )}

      {reservations === null && !error && <p className="text-muted">Carregando...</p>}
      {reservations?.length === 0 && <p className="text-muted">Voce ainda nao tem reservas.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {grouped.map(([day, items]) => (
          <div key={day}>
            <h3>{formatDateLabel(day)}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((r) => (
                <div
                  key={r.id}
                  className="card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
                >
                  <div>
                    <strong>{r.material.name}</strong>
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      {r.classPeriod.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === r.id}
                    onClick={() => handleCancel(r)}
                  >
                    <CalendarX2 size={16} /> Cancelar
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
