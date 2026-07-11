import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
}

const EMPTY_FORM = { name: "", phone: "", email: "" };

export function Pacientes() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filter, setFilter] = useState<"todos" | "novos">("todos");
  const [items, setItems] = useState<Patient[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    api
      .get<{ items: Patient[]; total: number }>(`/patients${query}`)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(p: Patient) {
    setEditingId(p.id);
    setForm({ name: p.name, phone: p.phone, email: p.email || "" });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { name: form.name, phone: form.phone, email: form.email || null };
      if (editingId) {
        await api.patch(`/patients/${editingId}`, payload);
      } else {
        await api.post("/patients", payload);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Patient) {
    if (!window.confirm(`Excluir "${p.name}"? Isso remove permanentemente o paciente e seus agendamentos/conversas. Esta ação não pode ser desfeita.`)) return;
    setError(null);
    try {
      await api.delete(`/patients/${p.id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const allItems = items || [];
  const stats = {
    total,
    novos: allItems.filter((p) => now - new Date(p.created_at).getTime() < monthMs).length,
  };

  const filtered = allItems.filter((p) => {
    if (filter === "novos") return now - new Date(p.created_at).getTime() < monthMs;
    return true;
  });

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{editingId ? "Editar paciente" : "Novo paciente"}</div>}
      <div>
        <label className="field-label">Nome</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Telefone</label>
        <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <label className="field-label">E-mail</label>
        <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
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
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>{total}</strong> pacientes cadastrados
          </p>
        </div>
        <button
          onClick={startCreate}
          style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 11, background: "var(--text)", color: "var(--bg)", fontSize: 13.5, fontWeight: 500 }}
        >
          + Novo paciente
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 420 }}>
          {formFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {formFields}
      </FormSheet>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: isMobile ? undefined : 420 }}>
        <div className="card">
          <div className="kpi-value">{stats.total}</div>
          <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Total cadastrados</div>
        </div>
        <div className="card">
          <div className="kpi-value">{stats.novos}</div>
          <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Novos (30 dias)</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 14, borderBottom: "1px solid var(--border-soft)" }}>
          <input
            className="input"
            style={{ maxWidth: isMobile ? "100%" : 300 }}
            placeholder="Buscar por nome, telefone ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="segmented">
            {(["todos", "novos"] as const).map((f) => (
              <span key={f} className={`segmented-item${filter === f ? " active" : ""}`} style={{ cursor: "pointer", textTransform: "capitalize" }} onClick={() => setFilter(f)}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {items === null && <div className="empty-state">Carregando...</div>}
        {items !== null && filtered.length === 0 && <div className="empty-state">Nenhum paciente encontrado.</div>}

        {items !== null && filtered.length > 0 && isMobile && (
          <div>
            {filtered.map((p) => {
              const displayName = p.name || "Contato sem nome";
              const initials = (p.name ? p.name.split(" ").map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
              return (
                <div key={p.id} className="mobile-list-item">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="avatar" style={{ background: "var(--accent-bg)", color: "var(--accent-dark)" }}>
                      {initials}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{displayName}</div>
                      {p.email && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{p.email}</div>}
                    </div>
                  </div>
                  <div className="mobile-list-row">
                    <span>{p.phone}</span>
                    <span>desde {new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="mobile-list-actions">
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => startEdit(p)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ flex: 1, borderRadius: 10, fontSize: 13 }} onClick={() => handleDelete(p)}>
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items !== null && filtered.length > 0 && !isMobile && (
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Telefone</th>
                <th>Cadastrado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const displayName = p.name || "Contato sem nome";
              const initials = (p.name ? p.name.split(" ").map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
                return (
                  <tr key={p.id}>
                    <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="avatar" style={{ background: "var(--accent-bg)", color: "var(--accent-dark)" }}>
                        {initials}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{displayName}</div>
                        {p.email && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{p.email}</div>}
                      </div>
                    </td>
                    <td>{p.phone}</td>
                    <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary" onClick={() => startEdit(p)}>
                        Editar
                      </button>
                      <button className="btn-danger" style={{ borderRadius: 8, padding: "6px 12px", fontSize: 12.5 }} onClick={() => handleDelete(p)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
