import { getSupabaseClient } from "../integrations/supabaseClient";
import { Schedule, ScheduleStatus } from "../types";

export async function createSchedule(params: {
  userId: string;
  patientName: string;
  phone: string;
  procedure: string;
  date: string;
  time: string;
  googleEventId: string;
}): Promise<Schedule> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .insert({
      user_id: params.userId,
      patient_name: params.patientName,
      phone: params.phone,
      procedure: params.procedure,
      date: params.date,
      time: params.time,
      google_event_id: params.googleEventId,
      status: "Agendado",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function findScheduleById(scheduleId: string): Promise<Schedule | null> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findActiveSchedulesByUser(userId: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "Agendado")
    .order("date", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function findScheduleByGoogleEventId(googleEventId: string): Promise<Schedule | null> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("google_event_id", googleEventId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateScheduleDateTime(
  scheduleId: string,
  date: string,
  time: string
): Promise<Schedule> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .update({ date, time, updated_at: new Date().toISOString() })
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateScheduleStatus(
  scheduleId: string,
  status: ScheduleStatus
): Promise<Schedule> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** Usado pela Agenda do CRM web (grade semanal). */
export async function findByDateRange(startDate: string, endDate: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .neq("status", "Cancelado")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function findSchedulesByDate(date: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("date", date)
    .eq("status", "Agendado");

  if (error) throw error;
  return data || [];
}

export async function findSchedulesNeedingReminder(date: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("date", date)
    .eq("status", "Agendado")
    .eq("reminder_sent", false);

  if (error) throw error;
  return data || [];
}

export async function markReminderSent(scheduleId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("schedules")
    .update({ reminder_sent: true, updated_at: new Date().toISOString() })
    .eq("id", scheduleId);

  if (error) throw error;
}

export async function markConfirmed(scheduleId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("schedules")
    .update({ confirmed: true, updated_at: new Date().toISOString() })
    .eq("id", scheduleId);

  if (error) throw error;
}
