import { getSupabaseClient } from "../integrations/supabaseClient";
import { PatientTimelineEvent } from "../types";

export async function findByUserId(userId: string): Promise<PatientTimelineEvent[]> {
  const { data, error } = await getSupabaseClient().from("patient_timeline_events").select("*").eq("user_id", userId).order("occurred_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function create(params: { userId: string; title: string; detail?: string | null; occurredAt?: string; createdBy: string | null }): Promise<PatientTimelineEvent> {
  const { data, error } = await getSupabaseClient()
    .from("patient_timeline_events")
    .insert({ user_id: params.userId, title: params.title, detail: params.detail ?? null, occurred_at: params.occurredAt ?? new Date().toISOString(), created_by: params.createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
