import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { BellIcon, LogOutIcon, PlusIcon, SearchIcon } from "./icons";

interface PatientMatch {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  onNewAppointment: () => void;
  onSignOut: () => void;
}

export function Topbar({ onNewAppointment, onSignOut }: Props) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) {
      setMatches([]);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .get<{ items: PatientMatch[] }>(`/patients?search=${encodeURIComponent(query)}&limit=5`)
        .then((r) => setMatches(r.items))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  function goToPatient() {
    navigate(`/pacientes?search=${encodeURIComponent(query)}`);
    setQuery("");
    setMatches([]);
  }

  return (
    <header className="topbar">
      <div className="topbar-search" style={{ position: "relative" }}>
        <SearchIcon color="var(--text-faint)" />
        <input
          placeholder="Buscar pacientes, agendamentos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && goToPatient()}
        />
        {matches.length > 0 && (
          <div className="card" style={{ position: "absolute", top: 46, left: 0, right: 0, zIndex: 20, padding: 4 }}>
            {matches.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate(`/pacientes?search=${encodeURIComponent(m.name)}`)}
                style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
              >
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.phone}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <button className="topbar-icon-btn" title="Notificações">
        <BellIcon />
        <span style={{ position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", border: "1.5px solid var(--sidebar-bg)" }} />
      </button>

      <button className="topbar-icon-btn" title="Sair" onClick={onSignOut}>
        <LogOutIcon />
      </button>

      <button
        onClick={onNewAppointment}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 38,
          padding: "0 16px",
          borderRadius: 11,
          background: "var(--text)",
          color: "var(--bg)",
          fontSize: 13.5,
          fontWeight: 500,
        }}
      >
        <PlusIcon />
        Novo agendamento
      </button>
    </header>
  );
}
