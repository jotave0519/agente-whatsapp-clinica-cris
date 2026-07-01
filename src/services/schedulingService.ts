import * as googleCalendar from "../integrations/googleCalendarClient";
import * as scheduleRepository from "../repositories/scheduleRepository";
import { Schedule } from "../types";

export async function checkAvailability(date: string, durationMinutes?: number): Promise<string[]> {
  return googleCalendar.checkAvailability(date, durationMinutes);
}

export async function createAppointment(params: {
  userId: string;
  name: string;
  phone: string;
  service: string;
  start: string;
  durationMinutes?: number;
}): Promise<Schedule> {
  const event = await googleCalendar.createEvent({
    name: params.name,
    phone: params.phone,
    service: params.service,
    start: params.start,
    durationMinutes: params.durationMinutes,
  });

  const startDate = new Date(params.start);
  const date = startDate.toISOString().slice(0, 10);
  const time = startDate.toISOString().slice(11, 16);

  return scheduleRepository.createSchedule({
    userId: params.userId,
    patientName: params.name,
    phone: params.phone,
    procedure: params.service,
    date,
    time,
    googleEventId: event.id!,
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

  const startDate = new Date(newStart);
  const date = startDate.toISOString().slice(0, 10);
  const time = startDate.toISOString().slice(11, 16);

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
