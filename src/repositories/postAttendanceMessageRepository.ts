import { getSupabaseClient } from "../integrations/supabaseClient";
import { PostAttendanceMessage } from "../types";

const MAX_POSTPONES = 12; // ~2h cada = ate ~24h esperando a conversa liberar antes de desistir

/** Grava todas as mensagens de um enrollment de uma vez, no momento da matricula. Cada scheduled_for e calculado independentemente (fim da consulta + delay), nunca encadeado. */
export async function insertPending(rows: { enrollmentId: string; flowMessageId: string; scheduledFor: Date }[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .insert(
      rows.map((r) => ({
        enrollment_id: r.enrollmentId,
        flow_message_id: r.flowMessageId,
        scheduled_for: r.scheduledFor.toISOString(),
        status: "pending",
      }))
    );
  if (error) throw error;
}

export async function cancelPendingForEnrollment(enrollmentId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("enrollment_id", enrollmentId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function findDue(limit: number): Promise<PostAttendanceMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Se ainda existe alguma mensagem pending pra esse enrollment - usado pra saber quando marcar o enrollment inteiro como 'completed'. */
export async function hasPendingForEnrollment(enrollmentId: string): Promise<boolean> {
  const { count, error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .select("*", { count: "exact", head: true })
    .eq("enrollment_id", enrollmentId)
    .eq("status", "pending");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function claim(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return (data || []).length > 0;
}

export async function markSent(id: string, body: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .update({ status: "sent", body, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markCancelled(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .update({ status: "failed", last_error: errorMessage.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailedOrRetry(id: string, attempts: number, errorMessage: string): Promise<void> {
  const nextAttempts = attempts + 1;
  const { error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .update({
      status: nextAttempts < 5 ? "pending" : "failed",
      attempts: nextAttempts,
      last_error: errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * "Ainda nao e a hora" (conversa ativa agora) - NAO e uma falha, por isso usa
 * um contador proprio (postpone_count), nunca attempts. Depois de
 * MAX_POSTPONES tentativas (~24h), desiste com elegancia (cancelled, nao
 * failed) em vez de insistir indefinidamente com uma mensagem que ja perdeu o
 * contexto temporal.
 */
export async function postpone(id: string, postponeCount: number, newScheduledFor: Date): Promise<void> {
  const nextCount = postponeCount + 1;
  const client = getSupabaseClient();
  if (nextCount >= MAX_POSTPONES) {
    const { error } = await client
      .from("post_attendance_messages")
      .update({ status: "cancelled", postpone_count: nextCount, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return;
  }

  const { error } = await client
    .from("post_attendance_messages")
    .update({ status: "pending", postpone_count: nextCount, scheduled_for: newScheduledFor.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Usado pelo Dashboard ("mensagens enviadas hoje"). */
export async function countSentSince(sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("post_attendance_messages")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}
