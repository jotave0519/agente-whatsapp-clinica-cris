import { getSupabaseClient } from "../integrations/supabaseClient";
import { ConfirmationStatus, Schedule, ScheduleStatus } from "../types";

export async function createSchedule(params: {
  userId: string;
  patientName: string;
  phone: string;
  procedure: string;
  date: string;
  time: string;
  googleEventId: string;
  notes?: string | null;
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
      notes: params.notes ?? null,
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

/** Usado pela pagina do paciente no CRM - todos os agendamentos, qualquer status, mais recentes primeiro. */
export async function findAllByUserId(userId: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

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

/** Sempre volta confirmation_status para 'pending' e marca was_rescheduled: um horario novo nunca herda a confirmacao do horario anterior. */
export async function updateScheduleDateTime(
  scheduleId: string,
  date: string,
  time: string
): Promise<Schedule> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .update({ date, time, confirmation_status: "pending", was_rescheduled: true, updated_at: new Date().toISOString() })
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** Unico status usado hoje e "Cancelado" (ver schedulingService.cancelAppointment) - por isso tambem fecha confirmation_status junto. */
export async function updateScheduleStatus(
  scheduleId: string,
  status: ScheduleStatus
): Promise<Schedule> {
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "Cancelado") update.confirmation_status = "cancelled";

  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .update(update)
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** Usado pelo Dashboard (card "Consultas aguardando confirmacao"). */
export async function countByConfirmationStatus(confirmationStatus: ConfirmationStatus): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("schedules")
    .select("*", { count: "exact", head: true })
    .eq("confirmation_status", confirmationStatus)
    .eq("status", "Agendado");

  if (error) throw error;
  return count ?? 0;
}

export async function setConfirmationStatus(scheduleId: string, confirmationStatus: ConfirmationStatus): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("schedules")
    .update({ confirmation_status: confirmationStatus, updated_at: new Date().toISOString() })
    .eq("id", scheduleId);

  if (error) throw error;
}

/** Chamado quando o paciente confirma presenca - grava a data/hora exatas da confirmacao. */
export async function markConfirmedNow(scheduleId: string): Promise<Schedule> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .update({ confirmation_status: "confirmed", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

/** Usado pelo Dashboard (card "Confirmacoes de Hoje") - sem filtrar status, para incluir cancelados no total do dia. */
export async function findAllByDate(date: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient().from("schedules").select("*").eq("date", date);
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

