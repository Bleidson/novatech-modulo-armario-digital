import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Power, PowerOff, ArrowUp, ArrowDown, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";

interface ClassPeriod {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  displayOrder: number;
  active: boolean;
}

interface ClassPeriodFormState {
  id: string | null;
  name: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FORM: ClassPeriodFormState = { id: null, name: "", startTime: "", endTime: "" };

// Grade de horarios/periodos de aula da escola (ex.: "1o horario", 07:00-07:50).
// CRUD completo do ADMIN, mais reordenacao simples via botoes subir/descer (sem
// drag-and-drop - lista curta, poucos horarios por escola).
export function ClassPeriods() {
  const [periods, setPeriods] = useState<ClassPeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ClassPeriodFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<ClassPeriod[]>("/class-periods")
      .then((data) => setPeriods([...data].sort((a, b) => a.displayOrder - b.displayOrder)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar os horarios."));
  }, []);

  useEffect(load, [load]);

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError(null);
  }

  function openEditForm(period: ClassPeriod) {
    setForm({
      id: period.id,
      name: period.name,
      startTime: period.startTime ?? "",
      endTime: period.endTime ?? "",
    });
    setFormOpen(true);
    setError(null);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        startTime: form.startTime.trim() ? form.startTime : null,
        endTime: form.endTime.trim() ? form.endTime : null,
      };
      if (form.id) {
        await api.put<ClassPeriod>(`/class-periods/${form.id}`, payload);
      } else {
        await api.post<ClassPeriod>("/class-periods", { ...payload, displayOrder: periods?.length ?? 0 });
      }
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel salvar o horario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(period: ClassPeriod) {
    setBusyId(period.id);
    setError(null);
    try {
      await api.post(`/class-periods/${period.id}/${period.active ? "deactivate" : "activate"}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel atualizar o horario.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(period: ClassPeriod) {
    if (!window.confirm(`Excluir "${period.name}"? Esta acao nao pode ser desfeita.`)) return;
    setBusyId(period.id);
    setError(null);
    try {
      await api.delete(`/class-periods/${period.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel excluir o horario.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!periods) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= periods.length) return;

    const current = periods[index];
    const target = periods[targetIndex];
    if (!current || !target) return;

    const reordered = [...periods];
    reordered[index] = target;
    reordered[targetIndex] = current;
    setPeriods(reordered);

    setError(null);
    try {
      await api.put("/class-periods/reorder", {
        items: reordered.map((p, i) => ({ id: p.id, displayOrder: i })),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel reordenar os horarios.");
      load();
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ marginBottom: 0 }}>Horarios</h1>
        {!formOpen && (
          <button type="button" className="btn btn-primary" onClick={openCreateForm}>
            <Plus size={16} /> Novo
          </button>
        )}
      </div>
      <p className="text-muted">Grade de horarios/periodos de aula em que reservas podem acontecer.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {formOpen && (
        <form className="card" style={{ marginBottom: 14 }} onSubmit={handleSubmit}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ marginBottom: 12 }}>{form.id ? "Editar horario" : "Novo horario"}</h3>
            <button type="button" className="btn" onClick={closeForm} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="field">
            <label htmlFor="period-name">Nome</label>
            <input
              id="period-name"
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ex.: 1o horario"
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="period-start">Inicio</label>
              <input
                id="period-start"
                className="input"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="period-end">Fim</label>
              <input
                id="period-end"
                className="input"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}

      {periods === null && <p className="text-muted">Carregando...</p>}
      {periods?.length === 0 && !formOpen && <p className="text-muted">Nenhum horario cadastrado.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {periods?.map((period, index) => (
          <div key={period.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button
                type="button"
                className="btn"
                style={{ padding: 4 }}
                disabled={index === 0}
                aria-label="Mover para cima"
                onClick={() => handleMove(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="btn"
                style={{ padding: 4 }}
                disabled={index === periods.length - 1}
                aria-label="Mover para baixo"
                onClick={() => handleMove(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{period.name}</strong>
                <span className={`badge ${period.active ? "badge-success" : "badge-pending"}`}>
                  {period.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              {(period.startTime || period.endTime) && (
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {period.startTime ?? "?"} - {period.endTime ?? "?"}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary" onClick={() => openEditForm(period)}>
                  <Pencil size={15} /> Editar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === period.id}
                  onClick={() => handleToggleActive(period)}
                >
                  {period.active ? <PowerOff size={15} /> : <Power size={15} />}
                  {period.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === period.id}
                  onClick={() => handleDelete(period)}
                >
                  <Trash2 size={15} /> Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
