import * as procedureRepository from "../repositories/procedureRepository";
import * as scheduleEventRepository from "../repositories/scheduleEventRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import * as patientDocumentRepository from "../repositories/patientDocumentRepository";
import * as patientGoalRepository from "../repositories/patientGoalRepository";
import * as patientMediaRepository from "../repositories/patientMediaRepository";
import * as patientNoteRepository from "../repositories/patientNoteRepository";
import * as patientTimelineEventRepository from "../repositories/patientTimelineEventRepository";
import * as transactionRepository from "../repositories/transactionRepository";
import { Schedule } from "../types";

const ACTIVE_WITHIN_DAYS = 60;

function normalizeProcedureName(name: string): string {
  return name.trim().toLowerCase();
}

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export interface PatientSummary {
  firstVisit: string | null;
  lastVisit: string | null;
  nextAppointment: { id: string; date: string; time: string; procedure: string } | null;
  totalVisits: number;
  totalInvested: number;
  mostFrequentProcedure: string | null;
  averageReturnDays: number | null;
  status: "Ativo" | "Em acompanhamento" | "Inativo";
}

export async function getSummary(userId: string): Promise<PatientSummary> {
  const [schedules, transactions] = await Promise.all([scheduleRepository.findAllByUserId(userId), transactionRepository.findByUserId(userId)]);

  const completed = schedules.filter((s) => s.status === "Concluido").sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const today = todayIso();

  const future = schedules
    .filter((s) => s.status === "Agendado" && s.date >= today)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  const firstVisit = completed[0]?.date ?? null;
  const lastCompleted = completed[completed.length - 1];
  const lastVisit = lastCompleted?.date ?? null;

  const totalInvested = transactions.filter((t) => t.type === "receita" && t.status === "pago").reduce((sum, t) => sum + Number(t.amount), 0);

  const counts = new Map<string, number>();
  for (const s of completed) {
    const key = normalizeProcedureName(s.procedure);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let mostFrequentProcedure: string | null = null;
  let bestCount = 0;
  for (const s of completed) {
    const key = normalizeProcedureName(s.procedure);
    const count = counts.get(key) || 0;
    if (count > bestCount) {
      bestCount = count;
      mostFrequentProcedure = s.procedure;
    }
  }

  let averageReturnDays: number | null = null;
  if (completed.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < completed.length; i += 1) {
      const prev = new Date(`${completed[i - 1].date}T12:00:00-03:00`).getTime();
      const curr = new Date(`${completed[i].date}T12:00:00-03:00`).getTime();
      gaps.push(Math.round((curr - prev) / (24 * 3600_000)));
    }
    averageReturnDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  let status: PatientSummary["status"] = "Inativo";
  if (future.length > 0) {
    status = "Em acompanhamento";
  } else if (lastVisit) {
    const daysSince = Math.round((Date.now() - new Date(`${lastVisit}T12:00:00-03:00`).getTime()) / (24 * 3600_000));
    if (daysSince <= ACTIVE_WITHIN_DAYS) status = "Ativo";
  }

  return {
    firstVisit,
    lastVisit,
    nextAppointment: future[0] ? { id: future[0].id, date: future[0].date, time: future[0].time, procedure: future[0].procedure } : null,
    totalVisits: completed.length,
    totalInvested,
    mostFrequentProcedure,
    averageReturnDays,
    status,
  };
}

export interface TreatmentSuggestion {
  procedure: string;
  lastDate: string;
  daysSince: number;
  recommendedIntervalDays: number;
  message: string;
}

/** Sugestoes de retorno baseadas em `procedures.recommended_interval_days` - aritmetica de datas sobre uma regra configurada pela clinica, nunca uma recomendacao medica. */
export async function getSuggestions(userId: string): Promise<TreatmentSuggestion[]> {
  const [schedules, procedures] = await Promise.all([scheduleRepository.findAllByUserId(userId), procedureRepository.listAll()]);
  const completed = schedules.filter((s) => s.status === "Concluido");

  const lastByProcedure = new Map<string, Schedule>();
  for (const s of completed) {
    const key = normalizeProcedureName(s.procedure);
    const existing = lastByProcedure.get(key);
    if (!existing || s.date > existing.date) lastByProcedure.set(key, s);
  }

  const suggestions: TreatmentSuggestion[] = [];
  for (const [key, schedule] of lastByProcedure) {
    const procedure = procedures.find((p) => normalizeProcedureName(p.name) === key);
    if (!procedure?.recommended_interval_days) continue;

    const daysSince = Math.round((Date.now() - new Date(`${schedule.date}T12:00:00-03:00`).getTime()) / (24 * 3600_000));
    if (daysSince < procedure.recommended_interval_days) continue;

    const months = Math.floor(daysSince / 30);
    const whenLabel = months >= 1 ? `${months} ${months === 1 ? "mês" : "meses"}` : `${daysSince} dias`;
    suggestions.push({
      procedure: schedule.procedure,
      lastDate: schedule.date,
      daysSince,
      recommendedIntervalDays: procedure.recommended_interval_days,
      message: `${schedule.procedure} realizado há ${whenLabel} — considere agendar retorno.`,
    });
  }

  return suggestions.sort((a, b) => b.daysSince - a.daysSince);
}

export interface TimelineItem {
  type: "schedule_event" | "payment" | "note" | "goal" | "media" | "document" | "manual";
  title: string;
  detail: string | null;
  occurred_at: string;
}

const SCHEDULE_EVENT_LABELS: Record<string, string> = {
  created: "Agendamento criado",
  confirmation_sent: "Pedido de confirmação enviado",
  nudge_sent: "Lembrete de confirmação enviado",
  confirmed: "Paciente confirmou presença",
  cancelled: "Agendamento cancelado",
  rescheduled: "Agendamento remarcado",
  completed: "Procedimento realizado",
  no_show: "Paciente faltou",
};

/** Agrega, em tempo de leitura, todas as fontes de evento do paciente numa unica timeline - nunca duplica dado em uma tabela nova. */
export async function getTimeline(userId: string): Promise<TimelineItem[]> {
  const [scheduleEvents, transactions, notes, goals, media, documents, manualEvents] = await Promise.all([
    scheduleEventRepository.findByUserId(userId),
    transactionRepository.findByUserId(userId),
    patientNoteRepository.findByUserId(userId),
    patientGoalRepository.findByUserId(userId),
    patientMediaRepository.findByUserId(userId),
    patientDocumentRepository.findByUserId(userId),
    patientTimelineEventRepository.findByUserId(userId),
  ]);

  const items: TimelineItem[] = [];

  for (const ev of scheduleEvents as any[]) {
    items.push({
      type: "schedule_event",
      title: SCHEDULE_EVENT_LABELS[ev.event_type] || ev.event_type,
      detail: `${ev.schedule_procedure} — ${ev.schedule_date} às ${ev.schedule_time}`,
      occurred_at: ev.created_at,
    });
  }

  for (const t of transactions) {
    if (t.type !== "receita") continue;
    items.push({ type: "payment", title: `Pagamento: ${t.description}`, detail: `R$ ${Number(t.amount).toFixed(2)} · ${t.status}`, occurred_at: `${t.occurred_on}T12:00:00` });
  }

  for (const n of notes) {
    items.push({ type: "note", title: "Observação clínica adicionada", detail: n.body, occurred_at: n.created_at });
  }

  for (const g of goals) {
    items.push({ type: "goal", title: g.status === "concluido" ? `Objetivo concluído: ${g.description}` : `Objetivo definido: ${g.description}`, detail: null, occurred_at: g.completed_at || g.created_at });
  }

  for (const m of media) {
    items.push({ type: "media", title: `Foto "${m.kind}" adicionada`, detail: null, occurred_at: m.created_at });
  }

  for (const d of documents) {
    items.push({ type: "document", title: `Documento adicionado: ${d.name}`, detail: d.category, occurred_at: d.created_at });
  }

  for (const e of manualEvents) {
    items.push({ type: "manual", title: e.title, detail: e.detail, occurred_at: e.occurred_at });
  }

  return items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
