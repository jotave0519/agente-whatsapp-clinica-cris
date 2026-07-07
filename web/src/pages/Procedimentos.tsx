import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface ProcedureItem {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  duration_minutes: number | null;
  active: boolean;
}

const EMPTY_FORM = { name: "", price: "", description: "", duration_minutes: "", active: true };

export function Procedimentos() {
  const isMobile = useIsMobile();
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

  async function handleDelete(p: ProcedureItem) {
    if (!window.confirm(`Excluir o procedimento "${p.name}"?`)) return;
    try {
      await api.delete(`/procedures/${p.id}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const procedureFormFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{editingId ? "Editar procedimento" : "Novo procedimento"}</div>}
      <div>
        <label className="field-label">Nome</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Preço (R$)</label>
          <input className="input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Duração (min)</label>
          <input className="input" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
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
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Procedimentos</h1>
          <p className="page-subtitle">Catálogo de serviços e protocolos da clínica</p>
        </div>
        <button
          onClick={startCreate}
          style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 11, background: "var(--text)", color: "var(--bg)", fontSize: 13.5, fontWeight: 500 }}
        >
          + Novo
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          {procedureFormFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {procedureFormFields}
      </FormSheet>

      {items === null && <div className="empty-state">Carregando...</div>}
      {items !== null && items.length === 0 && <div className="empty-state">Nenhum procedimento encontrado.</div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
        {(items || []).map((p) => (
          <div key={p.id} className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  background: "var(--accent-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--accent-dark)",
                }}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <span className={`badge ${p.active ? "badge-green" : "badge-neutral"}`}>{p.active ? "Ativo" : "Inativo"}</span>
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-.01em" }}>{p.name}</div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 6, flex: 1 }}>{p.description || "Sem descrição."}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{p.duration_minutes ? `${p.duration_minutes} min` : "—"}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{p.price != null ? `R$ ${p.price.toFixed(2)}` : "Sob avaliação"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => startEdit(p)}>
                Editar
              </button>
              <button className="btn-danger" style={{ borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600 }} onClick={() => handleDelete(p)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
