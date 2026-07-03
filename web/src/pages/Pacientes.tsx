import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Patient {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export function Pacientes() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Patient[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      api
        .get<{ items: Patient[]; total: number }>(`/patients${query}`)
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div>
      <h1 className="page-title">Pacientes</h1>
      <p className="page-subtitle">{total} paciente(s) cadastrados</p>

      <input
        className="input"
        style={{ maxWidth: 320, marginBottom: 16 }}
        placeholder="Buscar por nome ou telefone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="error-text">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Cadastrado em</th>
            </tr>
          </thead>
          <tbody>
            {items === null && (
              <tr>
                <td colSpan={3} className="empty-state">
                  Carregando...
                </td>
              </tr>
            )}
            {items !== null && items.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  Nenhum paciente encontrado.
                </td>
              </tr>
            )}
            {items?.map((p) => {
              const initials = p.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <tr key={p.id}>
                  <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="avatar" style={{ background: "var(--accent-bg)", color: "var(--accent-dark)" }}>
                      {initials}
                    </span>
                    {p.name}
                  </td>
                  <td>{p.phone}</td>
                  <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
