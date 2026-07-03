import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

interface StaffItem {
  id: string;
  name: string;
  email: string;
  role: "admin" | "recepcionista" | "profissional";
  active: boolean;
  last_sign_in_at: string | null;
}

const ROLE_LABELS: Record<StaffItem["role"], string> = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
  profissional: "Profissional",
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "recepcionista" as StaffItem["role"] };

export function Usuarios() {
  const [items, setItems] = useState<StaffItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get<{ items: StaffItem[] }>("/staff");
      setItems(r.items);
    } catch (e: any) {
      if (String(e.message).includes("403")) {
        setForbidden(true);
      } else {
        setError(e.message);
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStaff(id: string, patch: Partial<Pick<StaffItem, "role" | "active">>) {
    setSavingId(id);
    setError(null);
    try {
      await api.patch(`/staff/${id}`, patch);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/staff", form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: StaffItem) {
    if (!window.confirm(`Excluir o acesso de ${u.name}? Essa ação não pode ser desfeita.`)) return;
    setSavingId(u.id);
    setError(null);
    try {
      await api.delete(`/staff/${u.id}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="page-title">Usuários</h1>
        <div className="empty-state" style={{ marginTop: 40 }}>
          Acesso restrito a administradores.
        </div>
      </div>
    );
  }

  if (error && !items) return <div className="empty-state">{error}</div>;
  if (!items) return <div className="empty-state">Carregando...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-subtitle">Equipe e permissões de acesso à plataforma</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 11, background: "var(--text)", color: "var(--bg)", fontSize: 13.5, fontWeight: 500 }}
        >
          + Novo usuário
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {showForm && (
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20, display: "grid", gap: 12, maxWidth: 420 }}>
          <div>
            <label className="field-label">Nome</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">E-mail</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Senha inicial</label>
            <input className="input" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Função</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffItem["role"] })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Criando..." : "Criar usuário"}
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
              <th>Usuário</th>
              <th>Função</th>
              <th>Último acesso</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}</div>
                </td>
                <td>
                  <select
                    className="input"
                    style={{ width: "auto" }}
                    value={u.role}
                    disabled={savingId === u.id}
                    onChange={(e) => updateStaff(u.id, { role: e.target.value as StaffItem["role"] })}
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "Nunca"}</td>
                <td>
                  <button
                    className={`badge ${u.active ? "badge-green" : "badge-neutral"}`}
                    style={{ cursor: "pointer" }}
                    disabled={savingId === u.id}
                    onClick={() => updateStaff(u.id, { active: !u.active })}
                  >
                    {u.active ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td>
                  <button className="btn-danger" style={{ borderRadius: 8, padding: "6px 12px", fontSize: 12.5 }} disabled={savingId === u.id} onClick={() => handleDelete(u)}>
                    Excluir
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
