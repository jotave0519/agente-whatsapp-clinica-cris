import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface PatientOption {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  value: PatientOption | null;
  onChange: (patient: PatientOption | null) => void;
}

/** Campo de paciente pesquisável (opcional) - usado no formulário de Nova Receita do Financeiro. */
export function PatientPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.get<{ items: PatientOption[] }>(`/patients?search=${encodeURIComponent(query)}&limit=8`).then((r) => setResults(r.items)).catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--accent-bg)" }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--accent-dark)" }}>{value.name}</span>
        <button type="button" onClick={() => onChange(null)} style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-dark)" }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        placeholder="Pesquisar paciente..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-card)", zIndex: 10, maxHeight: 220, overflowY: "auto" }}>
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13 }}
              onClick={() => {
                onChange(p);
                setQuery("");
                setResults([]);
              }}
            >
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.phone}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
