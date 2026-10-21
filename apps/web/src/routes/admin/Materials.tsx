import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Power, PowerOff, ImagePlus, X } from "lucide-react";
import { api, ApiError, resolveUploadUrl, uploadMaterialImage } from "../../lib/api";

interface Material {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  active: boolean;
}

interface MaterialFormState {
  id: string | null;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
}

const EMPTY_FORM: MaterialFormState = { id: null, name: "", description: "", category: "", imageUrl: null };

// Catalogo de materiais reservaveis (projetor, laboratorio, carrinho de notebooks
// etc). CRUD completo do ADMIN: cadastro com upload de imagem (via endpoint da
// Foundation), edicao, ativar/desativar e exclusao (bloqueada pelo backend com 409
// quando ha reserva vinculada - ver materials.service.ts deleteMaterial).
export function Materials() {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MaterialFormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api
      .get<Material[]>("/materials")
      .then(setMaterials)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar os materiais."));
  }, []);

  useEffect(load, [load]);

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError(null);
  }

  function openEditForm(material: Material) {
    setForm({
      id: material.id,
      name: material.name,
      description: material.description ?? "",
      category: material.category ?? "",
      imageUrl: material.imageUrl,
    });
    setFormOpen(true);
    setError(null);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
  }

  async function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadMaterialImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description.trim() ? form.description : null,
        category: form.category.trim() ? form.category : null,
        imageUrl: form.imageUrl,
      };
      if (form.id) {
        await api.put<Material>(`/materials/${form.id}`, payload);
      } else {
        await api.post<Material>("/materials", payload);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o material.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(material: Material) {
    setBusyId(material.id);
    setError(null);
    try {
      await api.post(`/materials/${material.id}/${material.active ? "deactivate" : "activate"}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível atualizar o material.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(material: Material) {
    if (!window.confirm(`Excluir "${material.name}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(material.id);
    setError(null);
    try {
      await api.delete(`/materials/${material.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir o material.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ marginBottom: 0 }}>Materiais</h1>
        {!formOpen && (
          <button type="button" className="btn btn-primary" onClick={openCreateForm}>
            <Plus size={16} /> Novo
          </button>
        )}
      </div>
      <p className="text-muted">Catálogo de itens que podem ser reservados pelos professores.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {formOpen && (
        <form className="card" style={{ marginBottom: 14 }} onSubmit={handleSubmit}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ marginBottom: 12 }}>{form.id ? "Editar material" : "Novo material"}</h3>
            <button type="button" className="btn" onClick={closeForm} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="field">
            <label htmlFor="material-name">Nome</label>
            <input
              id="material-name"
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="material-category">Categoria</label>
            <input
              id="material-category"
              className="input"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Ex.: Audiovisual, Informatica"
            />
          </div>

          <div className="field">
            <label htmlFor="material-description">Descricao</label>
            <input
              id="material-description"
              className="input"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="field">
            <label>Imagem</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {form.imageUrl && (
                <img
                  src={resolveUploadUrl(form.imageUrl) ?? undefined}
                  alt=""
                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                />
              )}
              <button
                type="button"
                className="btn btn-secondary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={16} /> {uploading ? "Enviando..." : "Escolher imagem"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={handleImagePicked}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={saving || uploading}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}

      {materials === null && <p className="text-muted">Carregando...</p>}
      {materials?.length === 0 && !formOpen && <p className="text-muted">Nenhum material cadastrado.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {materials?.map((material) => (
          <div key={material.id} className="card" style={{ display: "flex", gap: 12 }}>
            {material.imageUrl ? (
              <img
                src={resolveUploadUrl(material.imageUrl) ?? undefined}
                alt=""
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-neutral-200)",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{material.name}</strong>
                <span className={`badge ${material.active ? "badge-success" : "badge-pending"}`}>
                  {material.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              {material.category && <div className="text-muted" style={{ fontSize: 13 }}>{material.category}</div>}
              {material.description && (
                <div className="text-muted" style={{ fontSize: 13 }}>{material.description}</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary" onClick={() => openEditForm(material)}>
                  <Pencil size={15} /> Editar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === material.id}
                  onClick={() => handleToggleActive(material)}
                >
                  {material.active ? <PowerOff size={15} /> : <Power size={15} />}
                  {material.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === material.id}
                  onClick={() => handleDelete(material)}
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
