import * as googleCalendar from "../integrations/googleCalendarClient";
import * as scheduleEventRepository from "../repositories/scheduleEventRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import { Schedule } from "../types";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import { toSaoPauloDateTimeParts } from "../utils/timezone";
import * as reminderEngine from "./reminderEngine";

const SCOPE = "schedulingService";

export async function checkAvailability(date: string, durationMinutes?: number): Promise<string[]> {
  return googleCalendar.checkAvailability(date, durationMinutes);
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
}): Promise<Schedule> {
  const event = await googleCalendar.createEvent({
    name: params.name,
    phone: params.phone,
    service: params.service,
    start: params.start,
    durationMinutes: params.durationMinutes,
    notes: params.notes,
  });

  const { date, time } = toSaoPauloDateTimeParts(new Date(params.start));

  const schedule = await scheduleRepository.createSchedule({
    userId: params.userId,
    patientName: params.name,
    phone: params.phone,
    procedure: params.service,
    date,
    time,
    googleEventId: event.id!,
    notes: params.notes,
    durationMinutes: params.durationMinutes ?? null,
    staffId: params.staffId ?? null,
  });

  // Nunca deixa uma falha do motor de lembretes mascarar como falha do
  // proprio agendamento (que ja foi criado com sucesso no Calendar/banco).
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
  if (!schedule.google_event_id) throw new AppError(`Agendamento sem evento no Google Calendar: ${scheduleId}`);

  await googleCalendar.updateEvent(schedule.google_event_id, newStart, durationMinutes);

  const { date, time } = toSaoPauloDateTimeParts(new Date(newStart));

  const updated = await scheduleRepository.updateScheduleDateTime(scheduleId, date, time);

  try {
    await reminderEngine.rescheduleRemindersForAppointment(updated);
  } catch (err) {
    logger.error(SCOPE, "Falha ao reagendar lembretes (remarcacao ja concluida com sucesso)", err);
  }

  return updated;
}

export async function cancelAppointment(scheduleId: string): Promise<Schedule> {
  const schedule = await scheduleRepository.findScheduleById(scheduleId);
  if (!schedule) throw new AppError(`Agendamento nao encontrado: ${scheduleId}`);

  if (schedule.google_event_id) {
    await googleCalendar.cancelEvent(schedule.google_event_id);
  }

  const updated = await scheduleRepository.updateScheduleStatus(scheduleId, "Cancelado");

  try {
    await reminderEngine.cancelRemindersForAppointment(scheduleId);
    await scheduleEventRepository.record(scheduleId, "cancelled");
  } catch (err) {
    logger.error(SCOPE, "Falha ao cancelar lembretes (cancelamento ja concluido com sucesso)", err);
  }

  return updated;
}
