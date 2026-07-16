import { getSupabaseClient } from "../integrations/supabaseClient";
import { ScheduleEvent, ScheduleEventType } from "../types";

export async function record(scheduleId: string, eventType: ScheduleEventType, detail?: string | null): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("schedule_events")
    .insert({ schedule_id: scheduleId, event_type: eventType, detail: detail ?? null });
  if (error) throw error;
}

/** Usado pela pagina do paciente (historico) - junta os eventos de todos os agendamentos do paciente, mais recentes primeiro. */
export async function findByUserId(userId: string): Promise<(ScheduleEvent & { schedule_procedure: string; schedule_date: string; schedule_time: string })[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedule_events")
    .select("*, schedules!inner(user_id, procedure, date, time)")
    .eq("schedules.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    schedule_procedure: row.schedules?.procedure,
    schedule_date: row.schedules?.date,
    schedule_time: row.schedules?.time,
  }));
}

/** Usado pelo grafico do Dashboard (Confirmacoes/Cancelamentos/Remarcacoes - ultimos 30 dias). */
export async function countByTypeSince(
  eventTypes: ScheduleEventType[],
  sinceIso: string
): Promise<{ event_type: ScheduleEventType; created_at: string }[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedule_events")
    .select("event_type, created_at")
    .in("event_type", eventTypes)
    .gte("created_at", sinceIso);

  if (error) throw error;
  return data || [];
}
