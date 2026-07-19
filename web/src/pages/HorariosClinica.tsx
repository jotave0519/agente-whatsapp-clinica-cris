import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

interface BusinessHourRow {
  weekday: number;
  enabled: boolean;
}

interface BusinessHourSlot {
  id: string;
  weekday: number;
  time: string;
}

interface BusinessHourException {
  id: string;
  date: string;
  type: "holiday" | "block" | "special";
  closed: boolean;
  slots: string[] | null;
  note: string | null;
}

const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
// Exibido em ordem segunda->domingo (mais natural pra uma clinica) - o weekday
// continua armazenado como 0=domingo por baixo, só a ordem de exibição muda.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TYPE_LABELS: Record<BusinessHourException["type"], string> = {
  holiday: "Feriado",
  block: "Bloqueio",
  special: "Dia especial",
};

const EMPTY_EXCEPTION = { date: "", type: "holiday" as BusinessHourException["type"], closed: true, note: "" };

function shortTime(t: string): string {
  return t.slice(0, 5);
}

/** Pequeno editor reutilizado tanto pela lista semanal quanto pelas exceções: lista de horários + botão excluir + "+ Adicionar horário". */
function SlotEditor({
  times,
  onAdd,
  onRemove,
}: {
  times: string[];
  onAdd: (time: string) => void;
  onRemove: (time: string) => void;
}) {
  const [newTime, setNewTime] = useState("");

  function handleAdd() {
    if (!newTime) return;
    onAdd(newTime);
    setNewTime("");
  }

  return (
    <div>
      {times.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 8 }}>Nenhum horário cadastrado ainda.</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {times.map((t) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "6px 6px 6px 12px",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => onRemove(t)}
              style={{ fontSize: 11.5, color: "var(--red)", padding: "3px 8px", borderRadius: 7, background: "var(--red-bg)" }}
            >
              Excluir
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="input" style={{ width: 130 }} type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        <button type="button" className="btn btn-secondary" onClick={handleAdd} disabled={!newTime}>
          + Adicionar horário
        </button>
      </div>
    </div>
  );
}

export function HorariosClinica() {
  const [hours, setHours] = useState<BusinessHourRow[] | null>(null);
  const [slots, setSlots] = useState<BusinessHourSlot[]>([]);
  const [exceptions, setExceptions] = useState<BusinessHourException[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exceptionForm, setExceptionForm] = useState(EMPTY_EXCEPTION);
  const [exceptionSlots, setExceptionSlots] = useState<string[]>([]);
  const [showExceptionForm, setShowExceptionForm] = useState(false);

  function loadSettings() {
    api
      .get<{ businessHours: BusinessHourRow[]; businessHourSlots: BusinessHourSlot[] }>("/settings")
      .then((r) => {
        setHours([...r.businessHours].sort((a, b) => a.weekday - b.weekday));
        setSlots(r.businessHourSlots);
      })
      .catch((e) => setError(e.message));
  }

  function loadExceptions() {
    api
      .get<{ items: BusinessHourException[] }>("/business-hours/exceptions")
      .then((r) => setExceptions(r.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadSettings();
    loadExceptions();
  }, []);

  async function handleToggleDay(weekday: number, enabled: boolean) {
    if (!hours) return;
    const updated = hours.map((h) => (h.weekday === weekday ? { ...h, enabled } : h));
    setHours(updated);
    try {
      await api.patch("/settings", { businessHours: updated });
    } catch (e: any) {
      setError(e.message);
      loadSettings();
    }
  }

  async function handleAddSlot(weekday: number, time: string) {
    try {
      await api.post("/business-hours/slots", { weekday, time });
      loadSettings();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleRemoveSlot(weekday: number, time: string) {
    const slot = slots.find((s) => s.weekday === weekday && shortTime(s.time) === time);
    if (!slot) return;
    try {
      await api.delete(`/business-hours/slots/${slot.id}`);
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch (e: any) {
      setError(e.message);
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
        slots: exceptionForm.closed ? null : exceptionSlots.length > 0 ? exceptionSlots : null,
        note: exceptionForm.note || null,
      });
      setShowExceptionForm(false);
      setExceptionForm(EMPTY_EXCEPTION);
      setExceptionSlots([]);
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
    <div>
      <h1 className="page-title">Horários da Clínica</h1>
      <p className="page-subtitle">Os horários oferecidos pelo WhatsApp são exatamente os cadastrados aqui — o sistema nunca cria horários automaticamente.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
        {error && <div className="error-text">{error}</div>}

        <div className="card">
          {DISPLAY_ORDER.map((weekday) => {
            const row = hours.find((h) => h.weekday === weekday);
            if (!row) return null;
            const dayTimes = slots.filter((s) => s.weekday === weekday).map((s) => shortTime(s.time)).sort();
            return (
              <div key={weekday} style={{ padding: "16px 0", borderTop: weekday === DISPLAY_ORDER[0] ? "none" : "1px solid var(--border-soft)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: row.enabled ? 12 : 0, cursor: "pointer" }}>
                  <input type="checkbox" checked={row.enabled} onChange={(e) => handleToggleDay(weekday, e.target.checked)} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{WEEKDAY_LABELS[weekday]}</span>
                  {!row.enabled && <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Fechado</span>}
                </label>
                {row.enabled && (
                  <div style={{ paddingLeft: 28 }}>
                    <SlotEditor
                      times={dayTimes}
                      onAdd={(time) => handleAddSlot(weekday, time)}
                      onRemove={(time) => handleRemoveSlot(weekday, time)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
                <div>
                  <label className="field-label">Horários personalizados para esse dia (deixe vazio para usar os horários normais da semana)</label>
                  <SlotEditor
                    times={exceptionSlots}
                    onAdd={(time) => setExceptionSlots((prev) => [...new Set([...prev, time])].sort())}
                    onRemove={(time) => setExceptionSlots((prev) => prev.filter((t) => t !== time))}
                  />
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
                    {TYPE_LABELS[ex.type]} — {ex.closed ? "fechado" : ex.slots && ex.slots.length > 0 ? ex.slots.map(shortTime).join(", ") : "horário normal da semana"}
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
    </div>
  );
}
