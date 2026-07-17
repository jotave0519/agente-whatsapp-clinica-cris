import { getSupabaseClient } from "../integrations/supabaseClient";
import { CommercialEvent, CommercialEventType } from "../types";

export async function record(opportunityId: string, eventType: CommercialEventType, detail?: string | null): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_events")
    .insert({ opportunity_id: opportunityId, event_type: eventType, detail: detail ?? null });
  if (error) throw error;
}

export async function findByOpportunityIds(opportunityIds: string[]): Promise<CommercialEvent[]> {
  if (opportunityIds.length === 0) return [];
  const { data, error } = await getSupabaseClient()
    .from("commercial_events")
    .select("*")
    .in("opportunity_id", opportunityIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Usado pela aba Historico do CRM - eventos recentes cross-oportunidade, com nome do paciente. */
export async function listRecent(limit = 50): Promise<(CommercialEvent & { patientName: string; procedureInterest: string })[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("commercial_events")
    .select("*, commercial_opportunities(procedure_interest, user_id, users(name))")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    patientName: row.commercial_opportunities?.users?.name ?? "",
    procedureInterest: row.commercial_opportunities?.procedure_interest ?? "",
  }));
}
