import * as googleCalendar from "../integrations/googleCalendarClient";
import * as scheduleRepository from "../repositories/scheduleRepository";
import { Schedule } from "../types";
import { toSaoPauloDateTimeParts } from "../utils/timezone";

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
      return { date: candidateDate, slots: slots.slice(0, 6) };
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

  return scheduleRepository.createSchedule({
    userId: params.userId,
    patientName: params.name,
    phone: params.phone,
    procedure: params.service,
    date,
    time,
    googleEventId: event.id!,
    notes: params.notes,
  });
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
  if (!schedule) throw new Error(`Agendamento nao encontrado: ${scheduleId}`);
  if (!schedule.google_event_id) throw new Error(`Agendamento sem evento no Google Calendar: ${scheduleId}`);

  await googleCalendar.updateEvent(schedule.google_event_id, newStart, durationMinutes);

  const { date, time } = toSaoPauloDateTimeParts(new Date(newStart));

  return scheduleRepository.updateScheduleDateTime(scheduleId, date, time);
}

export async function confirmAppointment(scheduleId: string): Promise<void> {
  await scheduleRepository.markConfirmed(scheduleId);
}

export async function cancelAppointment(scheduleId: string): Promise<Schedule> {
  const schedule = await scheduleRepository.findScheduleById(scheduleId);
  if (!schedule) throw new Error(`Agendamento nao encontrado: ${scheduleId}`);

  if (schedule.google_event_id) {
    await googleCalendar.cancelEvent(schedule.google_event_id);
  }

  return scheduleRepository.updateScheduleStatus(scheduleId, "Cancelado");
}
