import * as googleCalendar from "../integrations/googleCalendarClient";
import * as scheduleEventRepository from "../repositories/scheduleEventRepository";
import * as scheduleReminderLogRepository from "../repositories/scheduleReminderLogRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import { Schedule } from "../types";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import { toSaoPauloDateTimeParts } from "../utils/timezone";
import * as businessHoursService from "./businessHoursService";
import * as reminderEngine from "./reminderEngine";

const SCOPE = "schedulingService";
const DEFAULT_SLOT_MINUTES = 30;

function todayIsoDateSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Fonte de verdade da disponibilidade e o proprio banco (agendamentos com
 * status "Agendado" no dia), nunca o Google Calendar - a Agenda precisa
 * continuar funcionando (WhatsApp/IA e CRM) mesmo com o Google fora do ar,
 * com token expirado, ou desconectado. Os horarios candidatos continuam
 * vindo de business_hour_slots, como antes.
 */
export async function checkAvailability(date: string, durationMinutes: number = DEFAULT_SLOT_MINUTES): Promise<string[]> {
  const { enabled, slots } = await businessHoursService.getDaySlots(date);
  if (!enabled) return [];

  const busySchedules = await scheduleRepository.findSchedulesByDate(date);
  const busy = busySchedules.map((s) => {
    const start = new Date(`${s.date}T${s.time.slice(0, 5)}:00-03:00`);
    const end = new Date(start.getTime() + (s.duration_minutes ?? DEFAULT_SLOT_MINUTES) * 60_000);
    return { start, end };
  });

  const isToday = date === todayIsoDateSaoPaulo();
  const minStartMs = Date.now() + 20 * 60_000;

  const results: string[] = [];
  for (const slotTime of slots) {
    const start = new Date(`${date}T${slotTime}:00-03:00`);
    if (isToday && start.getTime() < minStartMs) continue;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const overlaps = busy.some((b) => start.getTime() < b.end.getTime() && end.getTime() > b.start.getTime());
    if (!overlaps) results.push(start.toISOString());
  }
  return results;
}

/**
 * Quando a data pedida nao tem vaga, procura o proximo dia (ate
 * maxDaysForward dias a frente) que tenha horarios livres, para a IA poder
 * sugerir uma alternativa concreta em vez de so pedir outra data.
 */
export async function findNextAvailable(
  afterDate: string,
  durationMinutes?: number,
  maxDaysForward = 7
): Promise<{ date: string; slots: string[] } | null> {
  const cursor = new Date(`${afterDate}T12:00:00-03:00`);
  for (let i = 1; i <= maxDaysForward; i += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const candidateDate = cursor.toISOString().slice(0, 10);
    const slots = await checkAvailability(candidateDate, durationMinutes);
    if (slots.length > 0) {
      return { date: candidateDate, slots };
    }
  }
  return null;
}

export async function createAppointment(params: {
  userId: string;
  name: string;
  phone: string;
  service: string;
  start: string;
  durationMinutes?: number;
  notes?: string | null;
  staffId?: string | null;
  requestedProcedure?: string | null;
}): Promise<Schedule> {
  const { date, time } = toSaoPauloDateTimeParts(new Date(params.start));

  // O banco e a fonte de verdade da Agenda - o agendamento precisa existir
  // aqui independente do Google Calendar estar disponivel ou nao.
  const schedule = await scheduleRepository.createSchedule({
    userId: params.userId,
    patientName: params.name,
    phone: params.phone,
    procedure: params.service,
    date,
    time,
    notes: params.notes,
    durationMinutes: params.durationMinutes ?? null,
    staffId: params.staffId ?? null,
    requestedProcedure: params.requestedProcedure ?? null,
  });

  // Sincronizacao com o Google Calendar e best-effort: token expirado, Google
  // fora do ar ou qualquer outro erro aqui nunca pode desfazer/impedir um
  // agendamento que ja existe no banco. Se der certo, guarda o google_event_id
  // pra permitir remarcacao/cancelamento sincronizados depois.
  try {
    const event = await googleCalendar.createEvent({
      name: params.name,
      phone: params.phone,
      service: params.service,
      start: params.start,
      durationMinutes: params.durationMinutes,
      notes: params.notes,
      requestedProcedure: params.requestedProcedure,
    });
    if (event.id) {
      await scheduleRepository.updateGoogleEventId(schedule.id, event.id);
      schedule.google_event_id = event.id;
    }
  } catch (err) {
    logger.error(SCOPE, "Falha ao sincronizar novo agendamento com o Google Calendar (agendamento ja criado com sucesso no banco)", err);
  }

  // Nunca deixa uma falha do motor de lembretes mascarar como falha do
  // proprio agendamento (que ja foi criado com sucesso no banco).
  try {
    await reminderEngine.scheduleConfirmationForAppointment(schedule);
  } catch (err) {
    logger.error(SCOPE, "Falha ao agendar confirmacao (agendamento ja criado com sucesso)", err);
  }

  return schedule;
}

export async function findAppointmentsForUser(userId: string): Promise<Schedule[]> {
  return scheduleRepository.findActiveSchedulesByUser(userId);
}

export async function rescheduleAppointment(
  scheduleId: string,
  newStart: string,
  durationMinutes?: number
): Promise<Schedule> {
  const schedule = await scheduleRepository.findScheduleById(scheduleId);
  if (!schedule) throw new AppError(`Agendamento nao encontrado: ${scheduleId}`);

  const { date, time } = toSaoPauloDateTimeParts(new Date(newStart));

  // Banco primeiro (fonte de verdade), Google depois e best-effort - mesmo
  // padrao de createAppointment.
  const updated = await scheduleRepository.updateScheduleDateTime(scheduleId, date, time);

  if (schedule.google_event_id) {
    try {
      await googleCalendar.updateEvent(schedule.google_event_id, newStart, durationMinutes);
    } catch (err) {
      logger.error(SCOPE, "Falha ao sincronizar remarcacao com o Google Calendar (remarcacao ja concluida com sucesso no banco)", err);
    }
  }

  try {
    await reminderEngine.rescheduleRemindersForAppointment(updated);
  } catch (err) {
    logger.error(SCOPE, "Falha ao reagendar lembretes (remarcacao ja concluida com sucesso)", err);
  }

  // Limpa o historico de lembrete-de-atendimento (push pra equipe) desse
  // agendamento - o horario mudou, entao precisa poder lembrar de novo no
  // horario novo (o lembrete antigo nunca chegou a "existir" salvo, ele e
  // sempre recalculado ao vivo pelo cron - so esse log de "ja lembrei" que
  // precisa ser zerado). Remarcar em si nunca gera notificacao - so o
  // lembrete de "esta chegando a hora" importa pra doutora.
  try {
    await scheduleReminderLogRepository.clearForSchedule(scheduleId);
  } catch (err) {
    logger.error(SCOPE, "Falha ao limpar log de lembrete apos remarcacao", err);
  }

  return updated;
}

export async function cancelAppointment(scheduleId: string): Promise<Schedule> {
  const schedule = await scheduleRepository.findScheduleById(scheduleId);
  if (!schedule) throw new AppError(`Agendamento nao encontrado: ${scheduleId}`);

  // Banco primeiro (fonte de verdade), Google depois e best-effort - mesmo
  // padrao de createAppointment/rescheduleAppointment.
  const updated = await scheduleRepository.updateScheduleStatus(scheduleId, "Cancelado");

  if (schedule.google_event_id) {
    try {
      await googleCalendar.cancelEvent(schedule.google_event_id);
    } catch (err) {
      logger.error(SCOPE, "Falha ao sincronizar cancelamento com o Google Calendar (cancelamento ja concluido com sucesso no banco)", err);
    }
  }

  try {
    await reminderEngine.cancelRemindersForAppointment(scheduleId);
    await scheduleEventRepository.record(scheduleId, "cancelled");
  } catch (err) {
    logger.error(SCOPE, "Falha ao cancelar lembretes (cancelamento ja concluido com sucesso)", err);
  }

  // Cancelamento em si nunca gera notificacao de push - o atendimento sai de
  // "Agendado", entao o cron de lembretes (que so olha status='Agendado')
  // automaticamente para de considera-lo, sem precisar de nenhuma acao aqui.

  return updated;
}
