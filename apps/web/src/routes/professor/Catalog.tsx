import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../lib/api";

interface AvailabilitySlot {
  materialId: string;
  materialName: string;
  classPeriodId: string;
  classPeriodName: string;
  reserved: boolean;
  // So vem preenchido para ADMIN (ver reservations.service.ts getAvailability) -
  // PROFESSOR nunca recebe o nome de outro professor aqui.
  reservedBy?: { id: string; name: string } | null;
}

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Catalogo do professor - grade Material x Horario para a data escolhida. Sem
// data no passado selecionavel (min=hoje no input, e o backend recusa de novo -
// ver reservations.service.ts createReservation). Tocar um slot livre reserva na
// hora; nao ha carrinho/confirmacao extra, e uma acao unica e reversivel (cancela
// em "Minhas reservas").
export function Catalog() {
  const todayISO = useMemo(todayISODate, []);
  const [date, setDate] = useState(todayISO);
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setSlots(null);
    setError(null);
    api
      .get<AvailabilitySlot[]>("/reservations/availability", { date })
      .then(setSlots)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar a disponibilidade."),
      );
  }, [date]);

  useEffect(load, [load]);

  const byMaterial = useMemo(() => {
    const map = new Map<string, { materialName: string; slots: AvailabilitySlot[] }>();
    for (const slot of slots ?? []) {
      const entry = map.get(slot.materialId) ?? { materialName: slot.materialName, slots: [] };
      entry.slots.push(slot);
      map.set(slot.materialId, entry);
    }
    return [...map.entries()];
  }, [slots]);

  async function handleReserve(slot: AvailabilitySlot) {
    const key = `${slot.materialId}:${slot.classPeriodId}`;
    setBusyKey(key);
    setError(null);
    setFeedback(null);
    try {
      await api.post("/reservations", {
        materialId: slot.materialId,
        classPeriodId: slot.classPeriodId,
        date,
      });
      setFeedback(`Reserva confirmada: ${slot.materialName} - ${slot.classPeriodName}.`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel reservar este horario.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <h1>Catalogo</h1>
      <p className="text-muted">Escolha a data e toque num horario livre para reservar.</p>

      <div className="field">
        <label htmlFor="catalog-date">Data</label>
        <input
          id="catalog-date"
          className="input"
          type="date"
          min={todayISO}
          value={date}
          onChange={(e) => setDate(e.target.value || todayISO)}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      {slots === null && !error && <p className="text-muted">Carregando...</p>}
      {slots?.length === 0 && <p className="text-muted">Nenhum material ou horario cadastrado ainda.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {byMaterial.map(([materialId, entry]) => (
          <div key={materialId} className="card">
            <strong>{entry.materialName}</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {entry.slots.map((slot) => {
                const key = `${slot.materialId}:${slot.classPeriodId}`;
                if (slot.reserved) {
                  return (
                    <span key={key} className="badge badge-taken">
                      {slot.classPeriodName} - reservado
                    </span>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    className="badge badge-success"
                    disabled={busyKey === key}
                    onClick={() => handleReserve(slot)}
                  >
                    {slot.classPeriodName} - livre
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
