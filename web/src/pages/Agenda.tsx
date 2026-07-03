import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

interface ScheduleItem {
  id: string;
  patient_name: string;
  procedure: string;
  date: string;
  time: string;
  status: string;
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // semana comeca na segunda
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function Agenda() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  useEffect(() => {
    const from = toDateStr(weekDays[0]);
    const to = toDateStr(weekDays[6]);
    setItems(null);
    setError(null);
    api
      .get<{ items: ScheduleItem[] }>(`/schedules?from=${from}&to=${to}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const todayStr = toDateStr(new Date());

  return (
    <div>
      <h1 className="page-title">Agenda</h1>
      <p className="page-subtitle">
        Semana de {weekDays[0].toLocaleDateString("pt-BR")} a {weekDays[6].toLocaleDateString("pt-BR")}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          className="btn btn-secondary"
          onClick={() =>
            setWeekStart((w) => {
              const d = new Date(w);
              d.setDate(d.getDate() - 7);
              return d;
            })
          }
        >
          ← Semana anterior
        </button>
        <button className="btn btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          Hoje
        </button>
        <button
          className="btn btn-secondary"
          onClick={() =>
            setWeekStart((w) => {
              const d = new Date(w);
              d.setDate(d.getDate() + 7);
              return d;
            })
          }
        >
          Próxima semana →
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="week-grid">
        {weekDays.map((d, i) => {
          const dateStr = toDateStr(d);
          const dayItems = (items || []).filter((it) => it.date === dateStr);
          return (
            <div key={dateStr} className="week-day">
              <div className={`week-day-header${dateStr === todayStr ? " today" : ""}`}>
                {WEEKDAY_LABELS[i]} {d.getDate()}
              </div>
              {items === null && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>...</div>}
              {items !== null && dayItems.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>—</div>}
              {dayItems.map((it) => (
                <div key={it.id} className="appt-chip" title={`${it.patient_name} — ${it.procedure}`}>
                  <div style={{ fontWeight: 600 }}>{it.time}</div>
                  <div>{it.patient_name}</div>
                  <div style={{ opacity: 0.8 }}>{it.procedure}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
