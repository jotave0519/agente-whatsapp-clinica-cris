import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

interface PatientMatch {
  id: string;
  name: string;
  phone: string;
}

interface ProcedureOption {
  id: string;
  name: string;
  active: boolean;
  duration_minutes: number | null;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function NewAppointmentModal({ onClose, onCreated }: Props) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientMatch | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [procedureId, setProcedureId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: ProcedureOption[] }>("/procedures")
      .then((r) => setProcedures(r.items.filter((p) => p.active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query || selectedPatient) {
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
  }, [query, selectedPatient]);

  function selectPatient(p: PatientMatch) {
    setSelectedPatient(p);
    setQuery(p.name);
    setMatches([]);
  }

  function clearPatient() {
    setSelectedPatient(null);
    setQuery("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const procedure = procedures.find((p) => p.id === procedureId);
    if (!procedure) {
      setError("Selecione um procedimento.");
      return;
    }
    if (!selectedPatient && !creatingNew) {
      setError("Selecione um paciente ou cadastre um novo.");
      return;
    }
    if (creatingNew && (!newName || !newPhone)) {
      setError("Informe nome e telefone do novo paciente.");
      return;
    }
    if (!date || !time) {
      setError("Informe data e horário.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/schedules", {
        userId: selectedPatient?.id,
        newPatient: creatingNew ? { name: newName, phone: newPhone } : undefined,
        procedure: procedure.name,
        start: `${date}T${time}:00-03:00`,
        durationMinutes: procedure.duration_minutes || undefined,
        notes: notes || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Novo agendamento</div>
          <button className="btn-secondary" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)" }} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="field-label">Paciente</label>
            {creatingNew ? (
              <div style={{ display: "grid", gap: 8 }}>
                <input className="input" placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className="input" placeholder="Telefone (com DDD)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                <button
                  type="button"
                  style={{ fontSize: 12, color: "var(--accent)", textAlign: "left" }}
                  onClick={() => {
                    setCreatingNew(false);
                    setNewName("");
                    setNewPhone("");
                  }}
                >
                  Buscar paciente já cadastrado
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  placeholder="Buscar por nome ou telefone"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedPatient(null);
                  }}
                />
                {matches.length > 0 && (
                  <div
                    className="card"
                    style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 5, padding: 4, maxHeight: 180, overflowY: "auto" }}
                  >
                    {matches.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => selectPatient(m)}
                        style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                      >
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedPatient && (
                  <div style={{ fontSize: 12, color: "var(--green)", marginTop: 6 }}>
                    Selecionado: {selectedPatient.name} ·{" "}
                    <button type="button" style={{ color: "var(--accent)" }} onClick={clearPatient}>
                      trocar
                    </button>
                  </div>
                )}
                <button type="button" style={{ fontSize: 12, color: "var(--accent)", marginTop: 6 }} onClick={() => setCreatingNew(true)}>
                  + Cadastrar novo paciente
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="field-label">Procedimento</label>
            <select className="input" value={procedureId} onChange={(e) => setProcedureId(e.target.value)}>
              <option value="">Selecione...</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Data</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Horário</label>
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Observações</label>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <div className="error-text">{error}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Salvando..." : "Criar agendamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
