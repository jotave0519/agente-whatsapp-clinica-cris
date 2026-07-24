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
  durationMinutes?: number | null;
  staffId?: string | null;
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
      duration_minutes: params.durationMinutes ?? null,
      staff_id: params.staffId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** Usado pela Ficha do Paciente ao registrar quem realizou um procedimento ja concluido. */
export async function updateStaff(scheduleId: string, staffId: string | null): Promise<Schedule> {
  const { data, error } = await getSupabaseClient().from("schedules").update({ staff_id: staffId, updated_at: new Date().toISOString() }).eq("id", scheduleId).select("*").single();
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

export interface SegmentationRow {
  user_id: string;
  procedure: string;
  status: ScheduleStatus;
  date: string;
  created_at: string;
}

/**
 * Usado pela varredura diaria de reativacao de pacientes - busca só as
 * colunas necessárias, paginado explicitamente em blocos de 1000. O
 * PostgREST tem limite default de 1000 linhas por request e NAO lança erro
 * ao estourar, só corta silenciosamente - sem essa paginação explícita,
 * pacientes mais antigos sumiriam da classificação sem aviso nenhum
 * conforme a tabela crescesse.
 */
export async function findAllForSegmentation(): Promise<SegmentationRow[]> {
  const PAGE_SIZE = 1000;
  const all: SegmentationRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await getSupabaseClient()
      .from("schedules")
      .select("user_id, procedure, status, date, created_at")
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

/**
 * Usado pelo cron de varredura de pos-atendimento (a cada 15 min) - candidatos
 * a "consulta cujo horario ja passou mas ninguem marcou o desfecho ainda".
 * Janela movel de 14 dias (nao a tabela inteira) - consultas mais antigas que
 * isso ja teriam sido matriculadas ou nao fazem mais sentido pra um check-in.
 */
export async function findRecentAgendadoForPostAttendanceScan(daysBack = 14): Promise<Schedule[]> {
  const since = new Date(Date.now() - daysBack * 24 * 3600_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("status", "Agendado")
    .gte("date", since)
    .lte("date", today)
    .order("date", { ascending: true });

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

