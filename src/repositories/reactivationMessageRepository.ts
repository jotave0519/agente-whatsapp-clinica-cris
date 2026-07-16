import { getSupabaseClient } from "../integrations/supabaseClient";
import { ReactivationMessage, ReminderTier } from "../types";

/** Mesmo padrao de src/repositories/reminderRepository.ts::insertPending - upsert que RESETA no conflito (nunca usado pra recriar um target ja terminal, so pra gerar novos tiers dentro de um target vivo). */
export async function insertPending(rows: { targetId: string; tier: ReminderTier; scheduledFor: Date }[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await getSupabaseClient()
    .from("reactivation_messages")
    .upsert(
      rows.map((r) => ({
        target_id: r.targetId,
        tier: r.tier,
        scheduled_for: r.scheduledFor.toISOString(),
        status: "pending",
        attempts: 0,
        last_error: null,
        sent_at: null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "target_id,tier" }
    );
  if (error) throw error;
}

export async function cancelPendingForTarget(targetId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("reactivation_messages")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("target_id", targetId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function findDue(limit: number): Promise<ReactivationMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from("reactivation_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Claim atomico - mesmo mecanismo do motor de confirmacao (pending->sending so muda se ninguem mais pegou a linha ainda). */
export async function claim(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("reactivation_messages")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return (data || []).length > 0;
}

/** Marcado logo apos o envio ter sucesso, ANTES de qualquer outra escrita - grava tambem o texto realmente enviado, pra auditoria. */
export async function markSent(id: string, body: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("reactivation_messages")
    .update({ status: "sent", body, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markCancelled(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("reactivation_messages")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("reactivation_messages")
    .update({ status: "failed", last_error: errorMessage.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailedOrRetry(id: string, attempts: number, errorMessage: string): Promise<void> {
  const nextAttempts = attempts + 1;
  const { error } = await getSupabaseClient()
    .from("reactivation_messages")
    .update({
      status: nextAttempts < 5 ? "pending" : "failed",
      attempts: nextAttempts,
      last_error: errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Usado pelo Dashboard ("mensagens enviadas hoje"). */
export async function countSentSince(sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("reactivation_messages")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}
