import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  ImageOff,
  MessageCircle,
  X,
} from "lucide-react";
import { api, ApiError, resolveUploadUrl } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTenantPath } from "../../lib/tenantPath";

interface Material {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

interface ClassPeriod {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  displayOrder: number;
}

interface AvailabilitySlot {
  materialId: string;
  classPeriodId: string;
  reserved: boolean;
  reservationId?: string;
  reservedBy?: { id: string; name: string } | null;
}

const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX"];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISODate(): string {
  return toISODate(new Date());
}

// Segunda-feira (getDay()===1) da semana que contem `iso` - semana escolar,
// SEG-SEX (5 colunas), mesma decisao do prototipo anexado.
function mondayOfWeek(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function shiftWeek(iso: string, deltaDays: number): string {
  const monday = mondayOfWeek(iso);
  monday.setDate(monday.getDate() + deltaDays);
  return toISODate(monday);
}

function weekDays(iso: string): Date[] {
  const monday = mondayOfWeek(iso);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatWeekRangeLabel(days: Date[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "";
  const sameMonth = first.getMonth() === last.getMonth();
  const monthName = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });
  if (sameMonth) {
    return `${first.getDate()} — ${last.getDate()} de ${monthName(last)}`;
  }
  return `${first.getDate()} de ${monthName(first)} — ${last.getDate()} de ${monthName(last)}`;
}

type CellState = "past" | "busy-mine" | "busy-other" | "selected" | "free";

interface NegotiationTarget {
  reservationId: string;
  materialName: string;
  classPeriodName: string;
  dateLabel: string;
  reservedByName: string;
}

// Calendario semanal de um material - toda a interacao de reserva do modulo
// acontece aqui (Tarefa "Ajustes Visuais e Operacionais" secao 2). Multi-selecao
// de celulas livres, confirmacao em lote, cancelamento da propria reserva e
// negociacao com outro professor via WhatsApp direto da celula ocupada.
export function Calendar() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const { user } = useAuth();
  const todayISO = useMemo(todayISODate, []);

  const [material, setMaterial] = useState<Material | null>(null);
  const [classPeriods, setClassPeriods] = useState<ClassPeriod[] | null>(null);
  const [anchorDate, setAnchorDate] = useState(todayISO);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, AvailabilitySlot[]>>({});
  const [loadingGrid, setLoadingGrid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [negotiation, setNegotiation] = useState<NegotiationTarget | null>(null);
  const [negotiationReason, setNegotiationReason] = useState("");
  const [negotiationError, setNegotiationError] = useState<string | null>(null);
  const [negotiationSending, setNegotiationSending] = useState(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  const days = useMemo(() => weekDays(anchorDate), [anchorDate]);
  const dayISOs = useMemo(() => days.map(toISODate), [days]);

  useEffect(() => {
    if (!materialId) return;
    api
      .get<Material>(`/materials/${materialId}`)
      .then(setMaterial)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Material não encontrado."));
  }, [materialId]);

  useEffect(() => {
    api
      .get<ClassPeriod[]>("/class-periods", { active: true })
      .then(setClassPeriods)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar os horários."));
  }, []);

  const loadGrid = useCallback(() => {
    if (!materialId) return;
    setLoadingGrid(true);
    setError(null);
    Promise.all(
      dayISOs.map((iso) =>
        api
          .get<AvailabilitySlot[]>("/reservations/availability", { date: iso, materialId })
          .then((slots) => [iso, slots] as const),
      ),
    )
      .then((entries) => {
        setSlotsByDay(Object.fromEntries(entries));
        setLoadingGrid(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar a disponibilidade.");
        setLoadingGrid(false);
      });
    // Selecao nao sobrevive a troca de semana/recarregamento - evita confirmar uma
    // celula que nao esta mais visivel.
    setSelected(new Set());
  }, [materialId, dayISOs]);

  useEffect(loadGrid, [loadGrid]);

  function cellKey(dateISO: string, classPeriodId: string): string {
    return `${dateISO}:${classPeriodId}`;
  }

  function slotFor(dateISO: string, classPeriodId: string): AvailabilitySlot | undefined {
    return slotsByDay[dateISO]?.find((s) => s.classPeriodId === classPeriodId);
  }

  function cellState(dateISO: string, classPeriodId: string): CellState {
    if (dateISO < todayISO) return "past";
    const slot = slotFor(dateISO, classPeriodId);
    if (slot?.reserved) {
      return slot.reservedBy?.id === user?.id ? "busy-mine" : "busy-other";
    }
    if (selected.has(cellKey(dateISO, classPeriodId))) return "selected";
    return "free";
  }

  function toggleSelect(dateISO: string, classPeriodId: string) {
    const key = cellKey(dateISO, classPeriodId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCancel(slot: AvailabilitySlot, dateISO: string, classPeriodName: string) {
    if (!slot.reservationId) return;
    const confirmed = window.confirm(`Cancelar sua reserva de "${material?.name}" (${classPeriodName}, ${dateISO})?`);
    if (!confirmed) return;
    setError(null);
    try {
      await api.delete(`/reservations/${slot.reservationId}`);
      setFeedback("Reserva cancelada.");
      loadGrid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível cancelar esta reserva.");
    }
  }

  function openNegotiation(slot: AvailabilitySlot, dateISO: string, classPeriodName: string) {
    if (!slot.reservationId || !slot.reservedBy) return;
    setNegotiationError(null);
    setNegotiationReason("");
    setNegotiation({
      reservationId: slot.reservationId,
      materialName: material?.name ?? "",
      classPeriodName,
      dateLabel: dateISO,
      reservedByName: slot.reservedBy.name,
    });
  }

  async function confirmNegotiation() {
    if (!negotiation) return;
    if (!negotiationReason.trim()) {
      setNegotiationError("Descreva o motivo do pedido antes de continuar.");
      return;
    }
    setNegotiationSending(true);
    setNegotiationError(null);
    try {
      const { phone } = await api.get<{ phone: string }>(`/reservations/${negotiation.reservationId}/negotiate-contact`);
      const digits = phone.replace(/\D/g, "");
      const myName = user?.name ?? "um colega";
      const message =
        `Olá, ${negotiation.reservedByName}! Sou ${myName} e gostaria de negociar o horário ` +
        `${negotiation.materialName}, ${negotiation.dateLabel}, ${negotiation.classPeriodName} que você reservou. ` +
        `${negotiationReason.trim()}. Poderia me ajudar?`;
      const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
      setNegotiation(null);
      // Navegacao real (nao renderiza o numero em lugar nenhum da tela antes disso -
      // Tarefa secao 2.4.3).
      window.location.href = waLink;
    } catch (err) {
      setNegotiationError(err instanceof ApiError ? err.message : "Não foi possível iniciar a negociação.");
    } finally {
      setNegotiationSending(false);
    }
  }

  function handleCellClick(dateISO: string, classPeriodId: string, classPeriodName: string) {
    const state = cellState(dateISO, classPeriodId);
    if (state === "past") return;
    if (state === "free" || state === "selected") {
      toggleSelect(dateISO, classPeriodId);
      return;
    }
    const slot = slotFor(dateISO, classPeriodId);
    if (!slot) return;
    if (state === "busy-mine") {
      handleCancel(slot, dateISO, classPeriodName);
      return;
    }
    openNegotiation(slot, dateISO, classPeriodName);
  }

  async function handleConfirmReservations() {
    if (!materialId || selected.size === 0) return;
    setConfirming(true);
    setError(null);
    setFeedback(null);

    const attempts = [...selected].map((key) => {
      const [dateISO, classPeriodId] = key.split(":") as [string, string];
      return { dateISO, classPeriodId };
    });

    let okCount = 0;
    const failures: string[] = [];
    // Sequencial de proposito - cada POST e a fonte de verdade real de conflito
    // (constraint unica do banco), preferimos um resumo claro por celula a um
    // Promise.all que dificultaria dizer qual falhou e por que.
    for (const { dateISO, classPeriodId } of attempts) {
      try {
        await api.post("/reservations", { materialId, classPeriodId, date: dateISO });
        okCount += 1;
      } catch (err) {
        const cp = classPeriods?.find((c) => c.id === classPeriodId);
        const message = err instanceof ApiError ? err.message : "erro desconhecido";
        failures.push(`${dateISO} ${cp?.name ?? ""} - ${message}`);
      }
    }

    setConfirming(false);
    if (okCount > 0 && failures.length === 0) {
      setFeedback(`${okCount} reserva(s) confirmada(s) com sucesso.`);
    } else if (okCount > 0 && failures.length > 0) {
      setFeedback(`${okCount} reserva(s) confirmada(s). ${failures.length} não puderam ser criadas (outro professor reservou primeiro): ${failures.join("; ")}`);
    } else {
      setError(`Nenhuma reserva pode ser criada: ${failures.join("; ")}`);
    }
    loadGrid();
  }

  function openDatePicker() {
    try {
      datePickerRef.current?.showPicker?.();
    } catch {
      datePickerRef.current?.focus();
      datePickerRef.current?.click();
    }
  }

  const firstLoad = loadingGrid && Object.keys(slotsByDay).length === 0;
  if (!classPeriods || firstLoad) {
    return (
      <div>
        <button type="button" className="btn" onClick={() => navigate(tenantPath("/professor"))}>
          <ChevronLeft size={16} /> Materiais
        </button>
        {error && <div className="alert alert-error">{error}</div>}
        {!error && <p className="text-muted">Carregando...</p>}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="calendar-back" onClick={() => navigate(tenantPath("/professor"))}>
        <ChevronLeft size={14} /> Materiais
      </button>

      <div className="calendar-title-line">
        {material?.imageUrl ? (
          <img src={resolveUploadUrl(material.imageUrl) ?? undefined} alt="" className="calendar-title-image" />
        ) : (
          <div className="calendar-title-image calendar-title-image-placeholder">
            <ImageOff size={22} />
          </div>
        )}
        <div>
          <h1>{material?.name ?? "..."}</h1>
          {material?.description && <p className="text-muted">{material.description}</p>}
        </div>
      </div>

      <div className="week-nav">
        <button type="button" onClick={() => setAnchorDate((d) => shiftWeek(d, -7))} aria-label="Semana anterior">
          <ChevronLeft size={16} />
        </button>
        <b>{formatWeekRangeLabel(days)}</b>
        <button type="button" onClick={() => setAnchorDate((d) => shiftWeek(d, 7))} aria-label="Próxima semana">
          <ChevronRight size={16} />
        </button>
        <span className="week-nav-jump-wrap">
          <button type="button" onClick={openDatePicker} aria-label="Escolher data" className="week-nav-jump">
            <CalendarDays size={16} />
          </button>
          <input
            ref={datePickerRef}
            type="date"
            value={anchorDate}
            onChange={(e) => e.target.value && setAnchorDate(e.target.value)}
            className="week-nav-date-input"
            aria-hidden
            tabIndex={-1}
          />
        </span>
      </div>

      <div className="legend">
        <span><i className="legend-free" /> Livre</span>
        <span><i className="legend-busy" /> Reservado</span>
        <span><i className="legend-past" /> Passado</span>
        <span><i className="legend-selected" /> Selecionado</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      <div className="calendarwrap">
        <div className="calgrid">
          <div className="corner">HORÁRIO</div>
          {days.map((d, i) => (
            <div className="dayhead" key={dayISOs[i]}>
              <b>{WEEKDAY_LABELS[i]}</b>
              <span>{formatDayLabel(d)}</span>
            </div>
          ))}
          {classPeriods.map((period) => (
            <Fragment key={period.id}>
              <div className="time">
                <b>{period.name}</b>
                {period.startTime && <span>{period.startTime}</span>}
              </div>
              {dayISOs.map((dateISO) => {
                const state = cellState(dateISO, period.id);
                const slot = slotFor(dateISO, period.id);
                return (
                  <div
                    key={`${dateISO}-${period.id}`}
                    className={`slot slot-${state}`}
                    onClick={() => handleCellClick(dateISO, period.id, period.name)}
                  >
                    {state === "past" && <span>—</span>}
                    {state === "free" && <span>Disponível</span>}
                    {state === "selected" && (
                      <>
                        <CheckCircle2 size={15} />
                        <b>Selecionado</b>
                      </>
                    )}
                    {(state === "busy-mine" || state === "busy-other") && (
                      <>
                        <span>Reservado</span>
                        <b>{state === "busy-mine" ? "Você" : slot?.reservedBy?.name.replace(/^Prof\.?\s*/i, "")}</b>
                      </>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="reservebar">
          <div>
            <b>{selected.size} horário(s) selecionado(s)</b>
            <span>Você pode selecionar várias aulas da semana antes de confirmar.</span>
          </div>
          <button type="button" disabled={confirming} onClick={handleConfirmReservations}>
            {confirming ? "Reservando..." : "Reservar horários"} <CheckCircle2 size={14} />
          </button>
        </div>
      )}

      {negotiation && (
        <div className="modal-scrim" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-head">
              <h3>Negociar horário</h3>
              <button type="button" className="btn" onClick={() => setNegotiation(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <p className="text-muted">
              {negotiation.materialName} - {negotiation.classPeriodName} - {negotiation.dateLabel}, reservado por{" "}
              {negotiation.reservedByName}.
            </p>
            {negotiationError && <div className="alert alert-error">{negotiationError}</div>}
            <div className="field">
              <label htmlFor="negotiation-reason">Descreva seu pedido</label>
              <textarea
                id="negotiation-reason"
                className="input"
                rows={3}
                value={negotiationReason}
                onChange={(e) => setNegotiationReason(e.target.value)}
                placeholder="Ex.: preciso desse horário porque minha turma tem prova nesse dia..."
              />
            </div>
            <button type="button" className="btn btn-cta btn-block" disabled={negotiationSending} onClick={confirmNegotiation}>
              <MessageCircle size={16} /> {negotiationSending ? "Abrindo..." : "Continuar no WhatsApp"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
