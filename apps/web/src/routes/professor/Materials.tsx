import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ImageOff } from "lucide-react";
import { api, ApiError, resolveUploadUrl } from "../../lib/api";
import { useTenantPath } from "../../lib/tenantPath";

interface Material {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  active: boolean;
}

// Vitrine de materiais reservaveis - SO isso (Tarefa "Ajustes Visuais e
// Operacionais" secao 1). Renomeado de "Catalogo": nao existe mais reserva direta
// a partir daqui (nem selecao de data no topo) - cada card so leva para o
// Calendario do material (Calendar.tsx), onde toda a interacao de reserva
// acontece. Ativos apenas - material inativo/em manutencao nao aparece pro
// professor (GET /materials?active=true, mesmo filtro que a API ja suporta).
export function Materials() {
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Material[]>("/materials", { active: true })
      .then(setMaterials)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar os materiais."));
  }, []);

  useEffect(load, [load]);

  return (
    <div>
      <h1>Materiais</h1>
      <p className="text-muted">Escolha um material para consultar o calendario e reservar um horario.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {materials === null && !error && <p className="text-muted">Carregando...</p>}
      {materials?.length === 0 && <p className="text-muted">Nenhum material disponivel no momento.</p>}

      <div className="material-grid">
        {materials?.map((material) => (
          <article key={material.id} className="material-card">
            <div className="material-card-media">
              {material.imageUrl ? (
                <img src={resolveUploadUrl(material.imageUrl) ?? undefined} alt="" />
              ) : (
                <div className="material-card-placeholder">
                  <ImageOff size={28} />
                </div>
              )}
            </div>
            <div className="material-card-body">
              <h3>{material.name}</h3>
              {material.description && <p>{material.description}</p>}
              <button type="button" className="btn btn-primary btn-block" onClick={() => navigate(tenantPath(`/professor/calendario/${material.id}`))}>
                Ver calendario <ChevronRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
