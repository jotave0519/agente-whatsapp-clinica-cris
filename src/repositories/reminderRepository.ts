import { getSupabaseClient } from "../integrations/supabaseClient";
import { AppointmentReminder, ReminderTier } from "../types";

/**
 * Cria/reseta as linhas de um agendamento para 'pending'. Usa unique(schedule_id,tier)
 * como chave de conflito, mas SEM ignoreDuplicates - se ja existir uma linha
 * (ex: 'cancelled' de uma remarcacao anterior), o upsert sobrescreve status/
 * scheduled_for/attempts/sent_at/last_error, resetando-a de verdade. Com
 * ignoreDuplicates o conflito era simplesmente ignorado e a linha antiga
 * ficava presa em 'cancelled' para sempre - bug encontrado em teste ao vivo.
 */
export async function insertPending(rows: { scheduleId: string; tier: ReminderTier; scheduledFor: Date }[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await getSupabaseClient()
    .from("appointment_reminders")
    .upsert(
      rows.map((r) => ({
        schedule_id: r.scheduleId,
        tier: r.tier,
        scheduled_for: r.scheduledFor.toISOString(),
        status: "pending",
        attempts: 0,
        last_error: null,
        sent_at: null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "schedule_id,tier" }
    );
  if (error) throw error;
}

/** Usado ao cancelar/remarcar um agendamento - nunca deixa lembrete antigo pendente para o horario anterior. */
export async function cancelPendingForSchedule(scheduleId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("appointment_reminders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("schedule_id", scheduleId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function findDue(limit: number): Promise<AppointmentReminder[]> {
  const { data, error } = await getSupabaseClient()
    .from("appointment_reminders")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Claim atomico: so retorna a linha se conseguiu mudar pending->sending nesta
 * chamada. Se outra execucao ja pegou a linha (status != 'pending'), o update
 * afeta 0 linhas e `data` volta vazio - garante que o mesmo lembrete nunca e
 * processado duas vezes mesmo sem lock explicito de banco.
 */
export async function claim(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("appointment_reminders")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return (data || []).length > 0;
}

/** Marcado logo apos o envio ter sucesso, ANTES de qualquer outra escrita - e o que garante que nunca reenvia. */
export async function markSent(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("appointment_reminders")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markCancelled(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("appointment_reminders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Falha permanente (ex: sem telefone) - marca direto como 'failed', sem tentar de novo. */
export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("appointment_reminders")
    .update({ status: "failed", last_error: errorMessage.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Falha transitoria: volta para 'pending' (nova tentativa no proximo tick) enquanto attempts < 5, senao vira 'failed' terminal. */
export async function markFailedOrRetry(id: string, attempts: number, errorMessage: string): Promise<void> {
  const nextAttempts = attempts + 1;
  const { error } = await getSupabaseClient()
    .from("appointment_reminders")
    .update({
      status: nextAttempts < 5 ? "pending" : "failed",
      attempts: nextAttempts,
      last_error: errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
