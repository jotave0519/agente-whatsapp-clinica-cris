import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppointmentModal } from "../context/AppointmentModalContext";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";
import { layoutDayEvents } from "../lib/calendarLayout";
import { getDisplayStatus } from "../lib/scheduleStatus";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "../components/icons";
import { DayStrip } from "../components/DayStrip";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";

interface ScheduleItem {
  id: string;
  patient_name: string;
  procedure: string;
  date: string;
  time: string;
  status: string;
  confirmation_status: "pending" | "awaiting" | "confirmed" | "cancelled";
  was_rescheduled: boolean;
  notes: string | null;
  duration_minutes: number | null;
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

// HOUR_HEIGHT maior que antes (era 56) - da mais "respiro" pra grade inteira
// (pedido explicito de espaçamento), e ajuda a diferenciar melhor a duracao
// visual de consultas curtas vs longas.
const HOUR_HEIGHT = 64;
const MIN_EVENT_HEIGHT = 46;
const EVENT_GAP = 3;
const DEFAULT_DURATION_MINUTES = 30;
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

// "Hoje" precisa ser calculado no timezone da clinica, nunca em UTC direto:
// toISOString() muda de dia ~3h antes da meia-noite local (America/Sao_Paulo
// e UTC-3), o que fazia o dia seguinte aparecer como "hoje" a partir das 21h.
function todayStrSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// selectedDay precisa nascer na meia-noite local do dia de hoje (nao no
// instante atual): um "new Date()" puro carrega a hora corrente junto, e
// toDateStr() nele sofre o mesmo desvio de UTC do bug do "Hoje" - a Agenda
// abriria mostrando os agendamentos do dia seguinte a partir das 21h.
function todayLocalMidnight(): Date {
  return new Date(`${todayStrSaoPaulo()}T00:00:00`);
}

export function Agenda() {
  const { open: openNewAppointment, lastCreatedAt } = useAppointmentModal();
  const showToast = useToast();
  const isMobile = useIsMobile();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocalMidnight()));
  const [view, setView] = useState<"dia" | "semana" | "mes">("dia");
  const [selectedDay, setSelectedDay] = useState(() => todayLocalMidnight());
  // So pra escolher a direcao da transicao do conteudo (slide sutil) -
  // "next"/"prev" nas setas, "none" em qualquer selecao direta (Hoje, dia
  // especifico, troca de view), onde nao faz sentido sugerir uma direcao.
  const [navDirection, setNavDirection] = useState<"next" | "prev" | "none">("none");
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScheduleItem | null>(null);
  useBodyScrollLock(!!selected);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
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
    setNavDirection("none");
    setWeekStart(startOfWeek(todayLocalMidnight()));
    setSelectedDay(todayLocalMidnight());
  }

  function goToDay(deltaDays: number) {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + deltaDays);
    setSelectedDay(next);
    setWeekStart(startOfWeek(next));
  }

  function goToMonth(deltaMonths: number) {
    const next = new Date(selectedDay);
    next.setDate(1);
    next.setMonth(next.getMonth() + deltaMonths);
    setSelectedDay(next);
    setWeekStart(startOfWeek(next));
  }

  // As setas de navegacao mudam de passo conforme a visualizacao ativa -
  // um dia (Dia), uma semana (Semana) ou um mes (Mes).
  function goToPrevious() {
    setNavDirection("prev");
    if (view === "dia") goToDay(-1);
    else if (view === "mes") goToMonth(-1);
    else goToWeek(-1);
  }

  function goToNext() {
    setNavDirection("next");
    if (view === "dia") goToDay(1);
    else if (view === "mes") goToMonth(1);
    else goToWeek(1);
  }

  const visibleDays = isMobile ? [selectedDay] : view === "dia" ? [weekDays.find((d) => toDateStr(d) === toDateStr(selectedDay)) || weekDays[0]] : weekDays;

  // Grade do mes (Visualizacao "Mes") - sempre semanas completas (Seg-Dom),
  // incluindo dias do mes anterior/seguinte pra preencher a primeira/ultima
  // semana, do mesmo jeito que qualquer calendario mensal convencional.
  const monthGridDays = useMemo(() => {
    const first = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const last = new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0);
    const gridEnd = startOfWeek(last);
    gridEnd.setDate(gridEnd.getDate() + 6);
    const days: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay.getFullYear(), selectedDay.getMonth()]);

  function loadSchedules() {
    let from: string;
    let to: string;
    if (view === "mes") {
      const first = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
      const last = new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0);
      from = toDateStr(first);
      to = toDateStr(last);
    } else {
      from = toDateStr(weekDays[0]);
      to = toDateStr(weekDays[6]);
    }
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
  }, [view, weekStart, selectedDay.getFullYear(), selectedDay.getMonth(), lastCreatedAt]);

  // Quantidade de atendimentos por dia (usado pelos pontinhos da grade do
  // mes) - deriva de "items", que ja vem filtrado certo pra cada visualizacao.
  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    (items || []).forEach((it) => {
      map[it.date] = (map[it.date] || 0) + 1;
    });
    return map;
  }, [items]);

  const todayStr = todayStrSaoPaulo();
  const totalAppts = (items || []).length;
  const selectedDayAppts = (items || []).filter((it) => it.date === toDateStr(selectedDay)).length;

  // Rotulo do dia selecionado (usado so no header mobile) - compara por
  // dia de calendario (toDateStr), nunca por timestamp direto, seguindo o
  // mesmo padrao ja usado em todo o resto do arquivo.
  const selectedDayStr = toDateStr(selectedDay);
  let selectedDayLabel: string;
  if (selectedDayStr === todayStr) {
    selectedDayLabel = "Hoje";
  } else {
    // Parte de todayStr (ja calculado certo, no timezone da clinica) e nao
    // de "new Date()" direto - somar/subtrair dia num Date criado agora
    // carrega a hora atual junto, e caindo perto da meia-noite o mesmo
    // desvio de UTC do bug do "Hoje" tambem quebrava Amanha/Ontem.
    const todayLocalMidnight = new Date(`${todayStr}T00:00:00`);
    const tomorrow = new Date(todayLocalMidnight);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(todayLocalMidnight);
    yesterday.setDate(yesterday.getDate() - 1);
    if (selectedDayStr === toDateStr(tomorrow)) {
      selectedDayLabel = "Amanhã";
    } else if (selectedDayStr === toDateStr(yesterday)) {
      selectedDayLabel = "Ontem";
    } else {
      const weekday = WEEKDAY_LABELS[(selectedDay.getDay() + 6) % 7];
      const dd = String(selectedDay.getDate()).padStart(2, "0");
      const mm = String(selectedDay.getMonth() + 1).padStart(2, "0");
      selectedDayLabel = `${weekday}, ${dd}/${mm}`;
    }
  }

  // Cabecalho de data completo mostrado no celular, abaixo da faixa de dias
  // (ex: "Quinta-feira, 10 de setembro") - so formatacao, mesma selectedDay.
  const fullDayHeading = (() => {
    const raw = selectedDay.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  // Intervalo da semana visivel (usado na visualizacao "Semana"), ex:
  // "7 – 13 de setembro". Mes de referencia e o do ultimo dia da semana.
  const weekRangeHeading = (() => {
    const monthName = weekDays[6].toLocaleDateString("pt-BR", { month: "long" });
    return `${weekDays[0].getDate()} – ${weekDays[6].getDate()} de ${monthName}`;
  })();

  // Mes/ano da visualizacao "Mes", ex: "Setembro 2026".
  const monthYearLabel = (() => {
    const raw = selectedDay.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  // Rotulo da semana selecionada - relativo (Esta semana/Semana que vem/
  // Semana passada) so pras 3 semanas mais proximas de hoje; qualquer outra
  // mostra o intervalo de datas. weekStart e a semana-corrente (ambos
  // ancorados na meia-noite local) sao subtraidos direto em ms: nenhum dos
  // dois carrega hora do dia, entao a divisao por 7 dias sempre da um
  // numero inteiro exato de semanas de diferenca.
  const weekLabel = (() => {
    const currentWeekStart = startOfWeek(todayLocalMidnight());
    const weekOffset = Math.round((weekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weekOffset === 0) return "Esta semana";
    if (weekOffset === 1) return "Semana que vem";
    if (weekOffset === -1) return "Semana passada";
    return weekRangeHeading;
  })();

  // Rotulo central do nav (setas < >) - muda de acordo com a visualizacao
  // ativa, pra sempre descrever o periodo que esta sendo exibido.
  const navCenterLabel = view === "dia" ? selectedDayLabel : view === "mes" ? monthYearLabel : weekLabel;

  const subtitleCount = view === "dia" ? selectedDayAppts : totalAppts;
  const subtitleSuffix = view === "dia" ? "neste dia" : view === "semana" ? "nesta semana" : "neste mês";

  // Chave usada so pra forcar o React a remontar o card de conteudo (troca
  // de view, navegacao de dia/semana/mes) - reaproveita a animacao de
  // entrada que ".card" ja tem no resto do app, sem CSS/JS de transicao novo.
  const contentKey = view === "mes" ? `mes-${selectedDay.getFullYear()}-${selectedDay.getMonth()}` : `${view}-${toDateStr(weekStart)}-${toDateStr(selectedDay)}`;
  const navSlideClass = navDirection === "next" ? " slide-next" : navDirection === "prev" ? " slide-prev" : "";

  async function handleCancel() {
    if (!selected) return;
    setActing(true);
    try {
      await api.delete(`/schedules/${selected.id}`, { reason: cancelReason.trim() || undefined });
      setSelected(null);
      setCancelling(false);
      setCancelReason("");
      loadSchedules();
      showToast("✓ Agenda atualizada.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  async function handleOutcome(outcome: "completed" | "no_show") {
    if (!selected) return;
    setActing(true);
    try {
      await api.patch(`/schedules/${selected.id}/outcome`, { outcome });
      setSelected(null);
      loadSchedules();
      showToast("✓ Agenda atualizada.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  function renderHourColumn() {
    return (
      <div className="agenda-hour-col">
        {Array.from({ length: 13 }, (_, i) => i + 7).map((h) => (
          <div key={h} style={{ height: HOUR_HEIGHT }}>
            <span className="agenda-hour-label">{String(h).padStart(2, "0")}:00</span>
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

    const positioned = layoutDayEvents(
      dayItems.map((it) => ({ ...it, durationMinutes: it.duration_minutes || DEFAULT_DURATION_MINUTES })),
      HOUR_HEIGHT / 60,
      7,
      MIN_EVENT_HEIGHT,
      EVENT_GAP
    );

    return (
      <div
        key={dateStr}
        className="agenda-day-col"
        style={{
          height: 13 * HOUR_HEIGHT,
          borderLeft: "1px solid var(--border-soft)",
          backgroundImage: `repeating-linear-gradient(var(--surface), var(--surface) ${HOUR_HEIGHT - 1}px, var(--border-soft) ${HOUR_HEIGHT}px)`,
        }}
      >
        {isToday && nowOffset >= 0 && nowOffset <= 13 * HOUR_HEIGHT && (
          <div className="agenda-now-line" style={{ top: nowOffset }}>
            <span className="agenda-now-dot" />
          </div>
        )}
        {items === null && (
          <div style={{ padding: 8, display: "grid", gap: 6 }}>
            <Skeleton style={{ height: 32, borderRadius: 8 }} />
            <Skeleton style={{ height: 32, borderRadius: 8 }} />
          </div>
        )}
        {positioned.map(({ item: it, top, height, left, width }) => {
          const color = hashColor(it.procedure);
          const showProcedure = height >= 44;
          const showName = height >= 28;
          return (
            <div
              key={it.id}
              className="agenda-event"
              onClick={() => {
                setSelected(it);
                setCancelling(false);
                setCancelReason("");
              }}
              style={{
                top,
                height,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
                background: color.bg,
                borderLeft: `3px solid ${color.border}`,
              }}
            >
              <span className="agenda-event-status" style={{ background: getDisplayStatus(it).dot || "var(--text-faint)" }} />
              <div className="agenda-event-inner">
                <div className="agenda-event-time">{it.time.slice(0, 5)}</div>
                {showName && <div className="agenda-event-name">{it.patient_name}</div>}
                {showProcedure && <div className="agenda-event-procedure">{it.procedure}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /**
   * Mobile: lista cronologica agrupada por hora, em vez da grade com
   * colunas usada no desktop/tablet - o problema relatado ("3 conflitos =
   * 3 colunas ilegiveis") e do MODELO de visualizacao, nao de CSS, entao no
   * celular a agenda abandona posicionamento absoluto/colunas por completo.
   * Cartoes sempre ocupam 100% da largura; conflitos apenas empilham
   * (a lista cresce em altura, nunca encolhe em largura).
   */
  function renderMobileAgendaList() {
    const dateStr = toDateStr(selectedDay);
    const isToday = dateStr === todayStr;

    if (items === null) {
      return (
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
        </div>
      );
    }

    const dayItems = items.filter((it) => it.date === dateStr).slice().sort((a, b) => a.time.localeCompare(b.time));

    if (dayItems.length === 0) {
      return <div className="empty-state">Nenhum atendimento agendado para este dia.</div>;
    }

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const rows: ReactNode[] = [];
    let lastHour: string | null = null;
    let nowInserted = !isToday;

    const nowMarker = (
      <div key="now-marker" className="agenda-mobile-now">
        Agora
      </div>
    );

    for (const it of dayItems) {
      const [h, m] = it.time.split(":").map(Number);
      const itemMinutes = h * 60 + m;

      if (!nowInserted && itemMinutes >= nowMinutes) {
        rows.push(nowMarker);
        nowInserted = true;
      }

      const hourLabel = it.time.slice(0, 2);
      if (hourLabel !== lastHour) {
        rows.push(
          <div key={`hour-${hourLabel}`} className="agenda-mobile-hour-header">
            {hourLabel}:00
          </div>
        );
        lastHour = hourLabel;
      }

      const color = hashColor(it.procedure);
      rows.push(
        <div
          key={it.id}
          className="agenda-mobile-card"
          style={{ borderLeftColor: color.border }}
          onClick={() => {
            setSelected(it);
            setCancelling(false);
            setCancelReason("");
          }}
        >
          <div className="agenda-mobile-card-time">{it.time.slice(0, 5)}</div>
          <div className="agenda-mobile-card-body">
            <div className="agenda-mobile-card-name">{it.patient_name}</div>
            <div className="agenda-mobile-card-procedure">{it.procedure}</div>
          </div>
          <span className="agenda-mobile-card-status" style={{ background: getDisplayStatus(it).dot || "var(--text-faint)" }} />
        </div>
      );
    }
    if (!nowInserted) rows.push(nowMarker);

    return <div className="agenda-mobile-list">{rows}</div>;
  }

  /**
   * Visualizacao "Semana" no celular: mesma lista cronologica de cartoes ja
   * usada na visualizacao "Dia", so que agrupada por dia (em vez de por
   * hora) e cobrindo os 7 dias da semana visivel. Reaproveita 100% dos
   * dados e componentes visuais ja existentes - nenhuma logica nova de
   * agendamento, so uma forma diferente de agrupar os mesmos "items".
   */
  function renderMobileWeekList() {
    if (items === null) {
      return (
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
        </div>
      );
    }

    const rows: ReactNode[] = [];
    for (const day of weekDays) {
      const dateStr = toDateStr(day);
      const dayItems = items.filter((it) => it.date === dateStr).slice().sort((a, b) => a.time.localeCompare(b.time));
      if (dayItems.length === 0) continue;

      const isToday = dateStr === todayStr;
      const dd = String(day.getDate()).padStart(2, "0");
      const mm = String(day.getMonth() + 1).padStart(2, "0");
      rows.push(
        <div key={`day-${dateStr}`} className="agenda-mobile-hour-header">
          {WEEKDAY_LABELS[(day.getDay() + 6) % 7]}, {dd}/{mm}
          {isToday ? " · Hoje" : ""}
        </div>
      );

      for (const it of dayItems) {
        const color = hashColor(it.procedure);
        rows.push(
          <div
            key={it.id}
            className="agenda-mobile-card"
            style={{ borderLeftColor: color.border }}
            onClick={() => {
              setSelected(it);
              setCancelling(false);
              setCancelReason("");
            }}
          >
            <div className="agenda-mobile-card-time">{it.time.slice(0, 5)}</div>
            <div className="agenda-mobile-card-body">
              <div className="agenda-mobile-card-name">{it.patient_name}</div>
              <div className="agenda-mobile-card-procedure">{it.procedure}</div>
            </div>
            <span className="agenda-mobile-card-status" style={{ background: getDisplayStatus(it).dot || "var(--text-faint)" }} />
          </div>
        );
      }
    }

    if (rows.length === 0) {
      return <div className="empty-state">Nenhum atendimento agendado nesta semana.</div>;
    }

    return <div className="agenda-mobile-list">{rows}</div>;
  }

  /**
   * Visualizacao "Mes" - grade de calendario convencional (compartilhada
   * entre celular e desktop). So leitura: cada dia mostra um marcador se
   * tiver algum atendimento (via countsByDate), e clicar num dia troca pra
   * visualizacao "Dia" naquela data - nenhum dado e criado/alterado aqui.
   */
  function renderMonthGrid() {
    const monthIndex = selectedDay.getMonth();
    const selectedStr = toDateStr(selectedDay);
    return (
      <div>
        <div className="month-grid-weekdays">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="month-grid-weekday">
              {w}
            </div>
          ))}
        </div>
        <div className="month-grid">
          {monthGridDays.map((d) => {
            const dateStr = toDateStr(d);
            const isCurrentMonth = d.getMonth() === monthIndex;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedStr;
            const count = countsByDate[dateStr] || 0;
            return (
              <button
                key={dateStr}
                className={`month-cell${isCurrentMonth ? "" : " is-outside"}`}
                onClick={() => {
                  setNavDirection("none");
                  setSelectedDay(d);
                  setWeekStart(startOfWeek(d));
                  setView("dia");
                }}
              >
                <span className={`month-cell-number${isSelected ? " active" : ""}${!isSelected && isToday ? " is-today" : ""}`}>{d.getDate()}</span>
                {count > 0 && <span className="month-cell-dot" />}
              </button>
            );
          })}
        </div>
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
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            {new Date(selected.date + "T00:00:00").toLocaleDateString("pt-BR")} às {selected.time}
          </div>
          <span className={`badge ${getDisplayStatus(selected).cls}`} style={{ marginBottom: 14, display: "inline-block" }}>
            {getDisplayStatus(selected).label}
          </span>
          {selected.notes && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>Obs: {selected.notes}</div>}

          {!cancelling && selected.status === "Agendado" && new Date(`${selected.date}T${selected.time}`) < new Date() && (
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} disabled={acting} onClick={() => handleOutcome("completed")}>
                Marcar como realizado
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} disabled={acting} onClick={() => handleOutcome("no_show")}>
                Marcar como falta
              </button>
            </div>
          )}

          {cancelling ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Deseja realmente cancelar esta consulta?</div>
              <div>
                <label className="field-label">Motivo do cancelamento (opcional)</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Ex: A doutora precisou atender uma emergência."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>
                  O cliente será avisado automaticamente pelo WhatsApp e a IA vai conduzir a remarcação por lá.
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
          ) : (
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-danger" style={{ borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600 }} disabled={acting} onClick={() => setCancelling(true)}>
                Cancelar consulta
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
        {/* Sticky: fica fora da area rolavel da lista (mesmo scroll de ".main"),
            nunca sobrepoe horarios/cards/datas do mes - so ocupa a faixa fixa
            no topo, visivel em Dia/Semana/Mes por igual. Mesma acao de sempre
            (openNewAppointment), so a posicao/apresentacao mudou. */}
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", paddingBottom: 2 }}>
          <h1 className="page-title">Agenda</h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              <strong style={{ color: "var(--text)", fontWeight: 600 }}>{subtitleCount} atendimento(s)</strong> {subtitleSuffix}
            </p>
            <button className="btn" onClick={openNewAppointment} style={{ flex: "none" }}>
              <PlusIcon width={15} height={15} /> Nova sessão
            </button>
          </div>
        </div>

        <div className="segmented" style={{ marginBottom: 14 }}>
          <span className={`segmented-item${view === "dia" ? " active" : ""}`} onClick={() => { setNavDirection("none"); setView("dia"); }} style={{ flex: 1, textAlign: "center", cursor: "pointer" }}>
            Dia
          </span>
          <span className={`segmented-item${view === "semana" ? " active" : ""}`} onClick={() => { setNavDirection("none"); setView("semana"); }} style={{ flex: 1, textAlign: "center", cursor: "pointer" }}>
            Semana
          </span>
          <span className={`segmented-item${view === "mes" ? " active" : ""}`} onClick={() => { setNavDirection("none"); setView("mes"); }} style={{ flex: 1, textAlign: "center", cursor: "pointer" }}>
            Mês
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={goToPrevious}>
            <ChevronLeftIcon color="var(--text-muted)" />
          </button>
          <button style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text)", textAlign: "center" }} onClick={goToToday}>
            {navCenterLabel}
          </button>
          <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={goToNext}>
            <ChevronRightIcon color="var(--text-muted)" />
          </button>
        </div>

        {view !== "mes" && (
          <>
            <DayStrip days={weekDays} selected={selectedDay} onSelect={(d) => { setNavDirection("none"); setSelectedDay(d); }} />
            <div style={{ fontSize: 14.5, fontWeight: 600, margin: "14px 0 10px" }}>{view === "dia" ? fullDayHeading : weekRangeHeading}</div>
          </>
        )}

        {error && <div className="error-text">{error}</div>}

        {view === "mes" ? (
          <div key={contentKey} className={`card${navSlideClass}`} style={{ padding: 12 }}>
            {renderMonthGrid()}
          </div>
        ) : (
          // Sem altura/scroll proprios: a lista flui dentro do scroll unico da
          // pagina (".main", ja com padding inferior calculado pra nunca ficar
          // atras da barra de navegacao/area segura). Um container filho com
          // altura estimada + "overscroll-behavior: contain" travava o gesto
          // de arrastar assim que a rolagem interna acabava, escondendo o
          // ultimo atendimento sem deixar chegar nele de jeito nenhum.
          // key=contentKey: forca remontagem ao trocar de dia/semana/mes,
          // reaproveitando (ou direcionando, via navSlideClass) a animacao
          // de entrada que ".card" ja tem.
          <div key={contentKey} className={`card${navSlideClass}`} style={{ padding: 0, overflow: "hidden" }}>
            {view === "dia" ? renderMobileAgendaList() : renderMobileWeekList()}
          </div>
        )}

        {renderActionSheet()}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>{subtitleCount} atendimento(s)</strong> {subtitleSuffix}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, padding: 3 }}>
            <button
              style={{ width: 32, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={goToPrevious}
            >
              <ChevronLeftIcon color="var(--text-muted)" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, padding: "0 8px", cursor: "pointer" }} onClick={goToToday}>
              {navCenterLabel}
            </span>
            <button
              style={{ width: 32, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={goToNext}
            >
              <ChevronRightIcon color="var(--text-muted)" />
            </button>
          </div>
          <div className="segmented">
            <span className={`segmented-item${view === "dia" ? " active" : ""}`} onClick={() => { setNavDirection("none"); setView("dia"); }} style={{ cursor: "pointer" }}>
              Dia
            </span>
            <span className={`segmented-item${view === "semana" ? " active" : ""}`} onClick={() => { setNavDirection("none"); setView("semana"); }} style={{ cursor: "pointer" }}>
              Semana
            </span>
            <span className={`segmented-item${view === "mes" ? " active" : ""}`} onClick={() => { setNavDirection("none"); setView("mes"); }} style={{ cursor: "pointer" }}>
              Mês
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

      {view === "mes" ? (
        <div key={contentKey} className={`card${navSlideClass}`} style={{ padding: 20 }}>
          {renderMonthGrid()}
        </div>
      ) : (
        <div key={contentKey} className={`card${navSlideClass}`} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--border-soft)" }}>
            <div className="agenda-hour-col" style={{ paddingTop: 0 }} />
            {visibleDays.map((d) => {
              const dateStr = toDateStr(d);
              const isToday = dateStr === todayStr;
              return (
                <div key={dateStr} className="agenda-week-day">
                  <div className={`agenda-week-day-label${isToday ? " is-today" : ""}`}>{WEEKDAY_LABELS[(d.getDay() + 6) % 7]}</div>
                  <div className={`agenda-week-day-number${isToday ? " is-today" : ""}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          <div className="agenda-scroll" style={{ display: "flex", maxHeight: "calc(100vh - 260px)" }}>
            {renderHourColumn()}
            {visibleDays.map((d) => renderDayColumn(d))}
          </div>
        </div>
      )}

      {renderActionSheet()}
    </div>
  );
}
