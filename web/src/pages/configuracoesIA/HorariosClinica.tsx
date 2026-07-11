import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";

interface BusinessHourRow {
  weekday: number;
  enabled: boolean;
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
}

interface BusinessHourException {
  id: string;
  date: string;
  type: "holiday" | "block" | "special";
  closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const TYPE_LABELS: Record<BusinessHourException["type"], string> = {
  holiday: "Feriado",
  block: "Bloqueio",
  special: "Dia especial",
};

const EMPTY_EXCEPTION = { date: "", type: "holiday" as BusinessHourException["type"], closed: true, open_time: "", close_time: "", note: "" };

export function HorariosClinica() {
  const [hours, setHours] = useState<BusinessHourRow[] | null>(null);
  const [exceptions, setExceptions] = useState<BusinessHourException[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exceptionForm, setExceptionForm] = useState(EMPTY_EXCEPTION);
  const [showExceptionForm, setShowExceptionForm] = useState(false);

  function loadExceptions() {
    api
      .get<{ items: BusinessHourException[] }>("/business-hours/exceptions")
      .then((r) => setExceptions(r.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    api
      .get<{ businessHours: BusinessHourRow[] }>("/settings")
      .then((r) => setHours([...r.businessHours].sort((a, b) => a.weekday - b.weekday)))
      .catch((e) => setError(e.message));
    loadExceptions();
  }, []);

  function updateHour(weekday: number, patch: Partial<BusinessHourRow>) {
    setHours((prev) => (prev ? prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)) : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hours) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch("/settings", { businessHours: hours });
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateException(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/business-hours/exceptions", {
        date: exceptionForm.date,
        type: exceptionForm.type,
        closed: exceptionForm.closed,
        open_time: exceptionForm.closed ? null : exceptionForm.open_time || null,
        close_time: exceptionForm.closed ? null : exceptionForm.close_time || null,
        note: exceptionForm.note || null,
      });
      setShowExceptionForm(false);
      setExceptionForm(EMPTY_EXCEPTION);
      loadExceptions();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteException(ex: BusinessHourException) {
    if (!window.confirm(`Remover a exceção de ${new Date(ex.date + "T12:00:00").toLocaleDateString("pt-BR")}?`)) return;
    try {
      await api.delete(`/business-hours/exceptions/${ex.id}`);
      loadExceptions();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (error && !hours) return <div className="empty-state">{error}</div>;
  if (!hours) return <div className="empty-state">Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      {error && <div className="error-text">{error}</div>}
      {saved && <div style={{ color: "var(--green)", fontSize: 12.5 }}>Horários salvos.</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Horário semanal</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>Usado pela IA para oferecer horários no Google Calendar</div>
          {hours.map((h) => (
            <div key={h.weekday} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, padding: "9px 0", borderTop: "1px solid var(--border-soft)" }}>
              <input type="checkbox" checked={h.enabled} onChange={(e) => updateHour(h.weekday, { enabled: e.target.checked })} />
              <span style={{ fontSize: 13.5, fontWeight: 500, width: 90 }}>{WEEKDAY_LABELS[h.weekday]}</span>
              {h.enabled ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input className="input" style={{ width: 100 }} type="time" value={h.open_time.slice(0, 5)} onChange={(e) => updateHour(h.weekday, { open_time: e.target.value })} />
                    <span style={{ color: "var(--text-muted)" }}>às</span>
                    <input className="input" style={{ width: 100 }} type="time" value={h.close_time.slice(0, 5)} onChange={(e) => updateHour(h.weekday, { close_time: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Almoço</span>
                    <input
                      className="input"
                      style={{ width: 100 }}
                      type="time"
                      value={h.lunch_start ? h.lunch_start.slice(0, 5) : ""}
                      onChange={(e) => updateHour(h.weekday, { lunch_start: e.target.value || null })}
                    />
                    <span style={{ color: "var(--text-muted)" }}>às</span>
                    <input
                      className="input"
                      style={{ width: 100 }}
                      type="time"
                      value={h.lunch_end ? h.lunch_end.slice(0, 5) : ""}
                      onChange={(e) => updateHour(h.weekday, { lunch_end: e.target.value || null })}
                    />
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Fechado</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar horário semanal"}
          </button>
        </div>
      </form>

      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Feriados, bloqueios e dias especiais</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Datas específicas que sobrepõem o horário semanal padrão</div>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => setShowExceptionForm((v) => !v)}>
            {showExceptionForm ? "Cancelar" : "+ Adicionar"}
          </button>
        </div>

        {showExceptionForm && (
          <form onSubmit={handleCreateException} style={{ display: "grid", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="field-label">Data</label>
                <input className="input" type="date" required value={exceptionForm.date} onChange={(e) => setExceptionForm({ ...exceptionForm, date: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Tipo</label>
                <select className="input" value={exceptionForm.type} onChange={(e) => setExceptionForm({ ...exceptionForm, type: e.target.value as BusinessHourException["type"] })}>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={exceptionForm.closed} onChange={(e) => setExceptionForm({ ...exceptionForm, closed: e.target.checked })} />
              Clínica fechada nesse dia
            </label>
            {!exceptionForm.closed && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input className="input" style={{ width: 120 }} type="time" value={exceptionForm.open_time} onChange={(e) => setExceptionForm({ ...exceptionForm, open_time: e.target.value })} />
                <span style={{ color: "var(--text-muted)" }}>às</span>
                <input className="input" style={{ width: 120 }} type="time" value={exceptionForm.close_time} onChange={(e) => setExceptionForm({ ...exceptionForm, close_time: e.target.value })} />
              </div>
            )}
            <div>
              <label className="field-label">Observação</label>
              <input className="input" value={exceptionForm.note} onChange={(e) => setExceptionForm({ ...exceptionForm, note: e.target.value })} />
            </div>
            <button className="btn" type="submit">
              Salvar exceção
            </button>
          </form>
        )}

        <div style={{ marginTop: 14 }}>
          {(exceptions || []).length === 0 && <div className="empty-state">Nenhuma exceção cadastrada.</div>}
          {(exceptions || []).map((ex) => (
            <div key={ex.id} className="mobile-list-item" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{new Date(ex.date + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {TYPE_LABELS[ex.type]} — {ex.closed ? "fechado" : `${ex.open_time?.slice(0, 5)} às ${ex.close_time?.slice(0, 5)}`}
                  {ex.note ? ` — ${ex.note}` : ""}
                </div>
              </div>
              <div className="mobile-list-actions">
                <button className="btn-danger" style={{ flex: 1, borderRadius: 10, fontSize: 13 }} onClick={() => handleDeleteException(ex)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
