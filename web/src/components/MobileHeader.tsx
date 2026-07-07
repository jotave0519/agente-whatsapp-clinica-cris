import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ArrowLeftIcon, BellIcon, SearchIcon } from "./icons";

interface PatientMatch {
  id: string;
  name: string;
  phone: string;
}

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/agenda": "Agenda",
  "/pacientes": "Pacientes",
  "/conversas": "Conversas",
  "/procedimentos": "Procedimentos",
  "/financeiro": "Financeiro",
  "/estoque": "Estoque",
  "/usuarios": "Usuários",
  "/whatsapp": "WhatsApp",
  "/configuracoes": "Configurações",
};

export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PatientMatch[]>([]);

  const title = TITLES[location.pathname] || "Clínica Zangelmi";

  useEffect(() => {
    if (!query) {
      setMatches([]);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .get<{ items: PatientMatch[] }>(`/patients?search=${encodeURIComponent(query)}&limit=8`)
        .then((r) => setMatches(r.items))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  function goToPatient(name: string) {
    setSearching(false);
    setQuery("");
    navigate(`/pacientes?search=${encodeURIComponent(name)}`);
  }

  return (
    <>
      <header className="mobile-header">
        <div className="mobile-header-title">{title}</div>
        <button className="mobile-icon-btn" onClick={() => setSearching(true)}>
          <SearchIcon />
        </button>
        <button className="mobile-icon-btn">
          <BellIcon />
          <span style={{ position: "absolute", top: 10, right: 11, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", border: "1.5px solid var(--sidebar-bg)" }} />
        </button>
      </header>

      {searching && (
        <div className="mobile-search-overlay">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border-soft)" }}>
            <button className="mobile-icon-btn" onClick={() => setSearching(false)}>
              <ArrowLeftIcon />
            </button>
            <input
              autoFocus
              className="input"
              placeholder="Buscar pacientes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && query && goToPatient(query)}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {matches.map((m) => (
              <div key={m.id} onClick={() => goToPatient(m.name)} style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{m.phone}</div>
              </div>
            ))}
            {query && matches.length === 0 && <div className="empty-state">Nenhum paciente encontrado.</div>}
          </div>
        </div>
      )}
    </>
  );
}
