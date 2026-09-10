import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";

interface PendingProfessor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

// Fila de aprovacao de Professor - exclusiva do ADMIN. Funcionalidade completa da
// Foundation (auth module): lista quem se cadastrou e ainda esta PENDING, aprova
// ou rejeita. Depois da acao, o professor some da lista (o backend so devolve
// status PENDING).
export function PendingApprovals() {
  const [pending, setPending] = useState<PendingProfessor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<PendingProfessor[]>("/auth/professors/pending")
      .then(setPending)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar a fila."));
  }, []);

  useEffect(load, [load]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.post(`/auth/professors/${id}/approve`);
      setPending((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel aprovar.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await api.post(`/auth/professors/${id}/reject`, {});
      setPending((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel rejeitar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Aprovacoes</h1>
      <p className="text-muted">Professores que se cadastraram e aguardam liberacao.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {pending === null && <p className="text-muted">Carregando...</p>}
      {pending?.length === 0 && <p className="text-muted">Nenhum cadastro pendente.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pending?.map((p) => (
          <div key={p.id} className="card">
            <strong>{p.name}</strong>
            <div className="text-muted" style={{ fontSize: 13 }}>{p.email}</div>
            {p.phone && <div className="text-muted" style={{ fontSize: 13 }}>{p.phone}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyId === p.id}
                onClick={() => handleApprove(p.id)}
              >
                <Check size={16} /> Aprovar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busyId === p.id}
                onClick={() => handleReject(p.id)}
              >
                <X size={16} /> Rejeitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
