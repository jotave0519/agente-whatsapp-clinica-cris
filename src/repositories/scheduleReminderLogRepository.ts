import { getSupabaseClient } from "../integrations/supabaseClient";

/** (schedule_id, staff_id) ja lembrados - usado pelo cron pra nunca lembrar 2x. */
export async function findLoggedPairs(scheduleIds: string[]): Promise<Set<string>> {
  if (scheduleIds.length === 0) return new Set();
  const { data, error } = await getSupabaseClient().from("schedule_reminder_log").select("schedule_id, staff_id").in("schedule_id", scheduleIds);
  if (error) throw error;
  return new Set((data || []).map((r) => `${r.schedule_id}:${r.staff_id}`));
}

export async function log(scheduleId: string, staffId: string): Promise<void> {
  const { error } = await getSupabaseClient().from("schedule_reminder_log").insert({ schedule_id: scheduleId, staff_id: staffId });
  if (error) throw error;
}

/** Limpa o historico de lembrete de um atendimento - chamado ao remarcar, pra permitir lembrar de novo no horario novo. */
export async function clearForSchedule(scheduleId: string): Promise<void> {
  const { error } = await getSupabaseClient().from("schedule_reminder_log").delete().eq("schedule_id", scheduleId);
  if (error) throw error;
}
