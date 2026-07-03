import { useEffect, useState } from "react";
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

export function Usuarios() {
  const [items, setItems] = useState<StaffItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

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
      <h1 className="page-title">Usuários</h1>
      <p className="page-subtitle">Equipe e permissões de acesso à plataforma</p>

      {error && <div className="error-text">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Função</th>
              <th>Último acesso</th>
              <th>Status</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
