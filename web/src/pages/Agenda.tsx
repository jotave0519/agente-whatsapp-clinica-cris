import { useEffect, useMemo, useState } from "react";
import { useAppointmentModal } from "../context/AppointmentModalContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "../components/icons";
import { DayStrip } from "../components/DayStrip";
import { NewAppointmentFab } from "../components/NewAppointmentFab";

interface ScheduleItem {
  id: string;
  patient_name: string;
  procedure: string;
  date: string;
  time: string;
  status: string;
  notes: string | null;
}

const APPT_COLORS: { bg: string; border: string }[] = [
  { bg: "var(--accent-bg)", border: "var(--accent)" },
  { bg: "var(--blue-bg)", border: "var(--blue)" },
  { bg: "var(--green-bg)", border: "var(--green)" },
  { bg: "var(--yellow-bg)", border: "var(--yellow)" },
];

function hashColor(name: string): { bg: string; border: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return APPT_COLORS[hash % APPT_COLORS.length];
}

const HOUR_HEIGHT = 56;
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Agenda() {
  const { open: openNewAppointment, lastCreatedAt } = useAppointmentModal();
  const isMobile = useIsMobile();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<"dia" | "semana">("semana");
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScheduleItem | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [acting, setActing] = useState(false);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  function goToWeek(deltaWeeks: number) {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + deltaWeeks * 7);
      return d;
    });
    setSelectedDay((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + deltaWeeks * 7);
      return next;
    });
  }

  function goToToday() {
    setWeekStart(startOfWeek(new Date()));
    setSelectedDay(new Date());
  }

  const visibleDays = isMobile ? [selectedDay] : view === "dia" ? [weekDays.find((d) => toDateStr(d) === toDateStr(new Date())) || weekDays[0]] : weekDays;

  function loadSchedules() {
    const from = toDateStr(weekDays[0]);
    const to = toDateStr(weekDays[6]);
    setItems(null);
    setError(null);
    api
      .get<{ items: ScheduleItem[] }>(`/schedules?from=${from}&to=${to}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, lastCreatedAt]);

  const todayStr = toDateStr(new Date());
  const totalAppts = (items || []).length;

  async function handleCancel() {
    if (!selected) return;
    setActing(true);
    try {
      await api.delete(`/schedules/${selected.id}`, { reason: cancelReason.trim() || undefined });
      setSelected(null);
      setCancelling(false);
      setCancelReason("");
      loadSchedules();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  async function handleReschedule() {
    if (!selected || !newDate || !newTime) return;
    setActing(true);
    try {
      await api.patch(`/schedules/${selected.id}`, { start: `${newDate}T${newTime}:00-03:00` });
      setSelected(null);
      setRescheduling(false);
      loadSchedules();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  function renderHourColumn() {
    return (
      <div style={{ width: 52, flex: "0 0 52px", paddingTop: 6 }}>
        {Array.from({ length: 13 }, (_, i) => i + 7).map((h) => (
          <div key={h} style={{ height: HOUR_HEIGHT, textAlign: "right", paddingRight: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", position: "relative", top: -7 }}>{String(h).padStart(2, "0")}:00</span>
          </div>
        ))}
      </div>
    );
  }

  function renderDayColumn(d: Date) {
    const dateStr = toDateStr(d);
    const dayItems = (items || []).filter((it) => it.date === dateStr);
    const isToday = dateStr === todayStr;
    const now = new Date();
    const nowOffset = isToday ? ((now.getHours() - 7) * 60 + now.getMinutes()) * (HOUR_HEIGHT / 60) : -1;

    return (
      <div
        key={dateStr}
        style={{
          flex: 1,
          position: "relative",
          height: 13 * HOUR_HEIGHT,
          borderLeft: "1px solid var(--border-soft)",
          backgroundImage: `repeating-linear-gradient(var(--surface), var(--surface) ${HOUR_HEIGHT - 1}px, var(--border-soft) ${HOUR_HEIGHT}px)`,
        }}
      >
        {isToday && nowOffset >= 0 && nowOffset <= 13 * HOUR_HEIGHT && (
          <div style={{ position: "absolute", left: 0, right: 0, top: nowOffset, height: 1.5, background: "var(--accent)", zIndex: 3 }}>
            <span style={{ position: "absolute", left: -4, top: -3.5, width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
          </div>
        )}
        {items === null && <div style={{ padding: 10, fontSize: 11.5, color: "var(--text-muted)" }}>...</div>}
        {dayItems.map((it) => {
          const [h, m] = it.time.split(":").map(Number);
          const top = ((h - 7) * 60 + m) * (HOUR_HEIGHT / 60);
          const color = hashColor(it.procedure);
          return (
            <div
              key={it.id}
              onClick={() => {
                setSelected(it);
                setRescheduling(false);
                setCancelling(false);
                setCancelReason("");
                setNewDate(it.date);
                setNewTime(it.time);
              }}
              style={{
                position: "absolute",
                left: 4,
                right: 4,
                top,
                minHeight: 40,
                borderRadius: 8,
                padding: "5px 8px",
                background: color.bg,
                borderLeft: `3px solid ${color.border}`,
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", opacity: 0.85 }}>{it.time}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {it.patient_name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.procedure}</div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderActionSheet() {
    if (!selected) return null;
    return (
      <div
        className="modal-overlay"
        onClick={() => {
          setSelected(null);
          setCancelling(false);
          setCancelReason("");
        }}
      >
        <div className="modal-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{selected.patient_name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{selected.procedure}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
            {new Date(selected.date + "T00:00:00").toLocaleDateString("pt-BR")} às {selected.time}
          </div>
          {selected.notes && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>Obs: {selected.notes}</div>}

          {cancelling ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="field-label">Motivo do cancelamento (opcional)</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Ex: Imprevisto na agenda, problema interno, necessidade de reagendar..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>
                  O cliente será avisado automaticamente pelo WhatsApp e a IA vai oferecer remarcar. Se deixar em branco, só informamos que houve um
                  imprevisto.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setCancelling(false)}>
                  Voltar
                </button>
                <button
                  className="btn-danger"
                  style={{ borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 }}
                  disabled={acting}
                  onClick={handleCancel}
                >
                  {acting ? "Cancelando..." : "Confirmar cancelamento"}
                </button>
              </div>
            </div>
          ) : rescheduling ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setRescheduling(false)}>
                  Cancelar
                </button>
                <button className="btn" disabled={acting} onClick={handleReschedule}>
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-danger" style={{ borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 }} disabled={acting} onClick={() => setCancelling(true)}>
                Cancelar consulta
              </button>
              <button className="btn btn-secondary" onClick={() => setRescheduling(true)}>
                Remarcar
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSelected(null);
                  setCancelling(false);
                  setCancelReason("");
                }}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div>
        <h1 className="page-title">Agenda</h1>
        <p className="page-subtitle">
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>{totalAppts} atendimento(s)</strong> nesta semana
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => goToWeek(-1)}>
            <ChevronLeftIcon color="var(--text-muted)" />
          </button>
          <button style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--accent)", textAlign: "center" }} onClick={goToToday}>
            Hoje
          </button>
          <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => goToWeek(1)}>
            <ChevronRightIcon color="var(--text-muted)" />
          </button>
        </div>
        <DayStrip days={weekDays} selected={selectedDay} onSelect={setSelectedDay} />

        {error && <div className="error-text">{error}</div>}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", maxHeight: "calc(100dvh - 320px)", overflowY: "auto" }}>
            {renderHourColumn()}
            {visibleDays.map((d) => renderDayColumn(d))}
          </div>
        </div>

        {renderActionSheet()}
        <NewAppointmentFab />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">
            {weekDays[0].toLocaleDateString("pt-BR")} — {weekDays[6].toLocaleDateString("pt-BR")} ·{" "}
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>{totalAppts} atendimento(s)</strong> nesta semana
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, padding: 3 }}>
            <button
              style={{ width: 32, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => goToWeek(-1)}
            >
              <ChevronLeftIcon color="var(--text-muted)" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, padding: "0 8px", cursor: "pointer" }} onClick={goToToday}>
              Esta semana
            </span>
            <button
              style={{ width: 32, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => goToWeek(1)}
            >
              <ChevronRightIcon color="var(--text-muted)" />
            </button>
          </div>
          <div className="segmented">
            <span className={`segmented-item${view === "dia" ? " active" : ""}`} onClick={() => setView("dia")} style={{ cursor: "pointer" }}>
              Dia
            </span>
            <span className={`segmented-item${view === "semana" ? " active" : ""}`} onClick={() => setView("semana")} style={{ cursor: "pointer" }}>
              Semana
            </span>
          </div>
          <button
            onClick={openNewAppointment}
            style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 11, background: "var(--text)", color: "var(--bg)", fontSize: 13.5, fontWeight: 500 }}
          >
            <PlusIcon /> Novo
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--border-soft)" }}>
          <div style={{ width: 52, flex: "0 0 52px" }} />
          {visibleDays.map((d, i) => {
            const dateStr = toDateStr(d);
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} style={{ flex: 1, textAlign: "center", padding: "13px 6px", borderLeft: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: isToday ? "var(--accent)" : "var(--text-faint)" }}>
                  {WEEKDAY_LABELS[(d.getDay() + 6) % 7]}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    marginTop: 2,
                    color: isToday ? "#fff" : "var(--text)",
                    background: isToday ? "var(--accent)" : "transparent",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", maxHeight: 620, overflowY: "auto" }}>
          {renderHourColumn()}
          {visibleDays.map((d) => renderDayColumn(d))}
        </div>
      </div>

      {renderActionSheet()}
    </div>
  );
}
