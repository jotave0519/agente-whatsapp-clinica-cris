import { getSupabaseClient } from "../integrations/supabaseClient";
import { CommercialFollowUpMessage } from "../types";

const MAX_POSTPONES = 12; // ~2h cada = ate ~24h esperando a conversa liberar antes de desistir

export async function insertPending(opportunityId: string, scheduledFor: Date): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .insert({ opportunity_id: opportunityId, scheduled_for: scheduledFor.toISOString(), status: "pending" });
  if (error) throw error;
}

export async function cancelPendingForOpportunity(opportunityId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("opportunity_id", opportunityId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function hasPendingForOpportunity(opportunityId: string): Promise<boolean> {
  const { count, error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .select("*", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId)
    .eq("status", "pending");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function findDue(limit: number): Promise<CommercialFollowUpMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function claim(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return (data || []).length > 0;
}

export async function markSent(id: string, body: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .update({ status: "sent", body, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markCancelled(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .update({ status: "failed", last_error: errorMessage.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailedOrRetry(id: string, attempts: number, errorMessage: string): Promise<void> {
  const nextAttempts = attempts + 1;
  const { error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .update({
      status: nextAttempts < 5 ? "pending" : "failed",
      attempts: nextAttempts,
      last_error: errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** "Ainda nao e a hora" (conversa ativa agora) - NAO e falha, contador proprio, nunca attempts. */
export async function postpone(id: string, postponeCount: number, newScheduledFor: Date): Promise<void> {
  const nextCount = postponeCount + 1;
  const client = getSupabaseClient();
  if (nextCount >= MAX_POSTPONES) {
    const { error } = await client
      .from("commercial_follow_up_messages")
      .update({ status: "cancelled", postpone_count: nextCount, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return;
  }

  const { error } = await client
    .from("commercial_follow_up_messages")
    .update({ status: "pending", postpone_count: nextCount, scheduled_for: newScheduledFor.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Usado pelo Dashboard ("mensagens enviadas hoje", se necessario no futuro). */
export async function countSentSince(sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("commercial_follow_up_messages")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}
