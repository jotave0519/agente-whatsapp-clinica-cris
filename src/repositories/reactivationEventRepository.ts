import { getSupabaseClient } from "../integrations/supabaseClient";
import { ReactivationEvent, ReactivationEventType } from "../types";

export async function record(targetId: string, eventType: ReactivationEventType, detail?: string | null): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("reactivation_events")
    .insert({ target_id: targetId, event_type: eventType, detail: detail ?? null });
  if (error) throw error;
}

/** Usado pela tela de estatisticas por campanha. */
export async function findByTargetIds(targetIds: string[]): Promise<ReactivationEvent[]> {
  if (targetIds.length === 0) return [];
  const { data, error } = await getSupabaseClient()
    .from("reactivation_events")
    .select("*")
    .in("target_id", targetIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Usado pelo Dashboard ("mensagens enviadas hoje" e outras contagens por tipo/periodo). */
export async function countByTypeSince(eventTypes: ReactivationEventType[], sinceIso: string): Promise<{ event_type: ReactivationEventType; created_at: string }[]> {
  const { data, error } = await getSupabaseClient()
    .from("reactivation_events")
    .select("event_type, created_at")
    .in("event_type", eventTypes)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return data || [];
}
