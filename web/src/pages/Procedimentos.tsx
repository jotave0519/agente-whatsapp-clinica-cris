import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

interface ProcedureItem {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  duration_minutes: number | null;
  active: boolean;
}

const EMPTY_FORM = { name: "", category: "", price: "", description: "", duration_minutes: "", active: true };

export function Procedimentos() {
  const [items, setItems] = useState<ProcedureItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get<{ items: ProcedureItem[] }>("/procedures");
      setItems(r.items);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(p: ProcedureItem) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category || "",
      price: p.price != null ? String(p.price) : "",
      description: p.description || "",
      duration_minutes: p.duration_minutes != null ? String(p.duration_minutes) : "",
      active: p.active,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      category: form.category || null,
      price: form.price ? Number(form.price) : null,
      description: form.description || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      active: form.active,
    };
    try {
      if (editingId) {
        await api.patch(`/procedures/${editingId}`, payload);
      } else {
        await api.post("/procedures", payload);
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Procedimentos</h1>
          <p className="page-subtitle">Tratamentos oferecidos pela clínica</p>
        </div>
        <button className="btn" onClick={startCreate}>
          + Novo procedimento
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, display: "grid", gap: 12, maxWidth: 480 }}>
          <div>
            <label className="field-label">Nome</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Categoria</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Preço (R$)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Duração (min)</label>
              <input
                className="input"
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="field-label">Descrição</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativo
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Preço</th>
              <th>Duração</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items === null && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Carregando...
                </td>
              </tr>
            )}
            {items !== null && items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Nenhum procedimento cadastrado.
                </td>
              </tr>
            )}
            {items?.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{p.category || "—"}</td>
                <td>{p.price != null ? `R$ ${p.price.toFixed(2)}` : "Sob avaliação"}</td>
                <td>{p.duration_minutes ? `${p.duration_minutes} min` : "—"}</td>
                <td>
                  <span className={`badge ${p.active ? "badge-green" : "badge-neutral"}`}>{p.active ? "Ativo" : "Inativo"}</span>
                </td>
                <td>
                  <button className="btn btn-secondary" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
