import { getSupabaseClient } from "../integrations/supabaseClient";
import { PatientMedia, PatientMediaKind } from "../types";

export async function findByUserId(userId: string): Promise<PatientMedia[]> {
  const { data, error } = await getSupabaseClient().from("patient_media").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function create(params: { userId: string; scheduleId?: string | null; kind: PatientMediaKind; storagePath: string }): Promise<PatientMedia> {
  const { data, error } = await getSupabaseClient()
    .from("patient_media")
    .insert({ user_id: params.userId, schedule_id: params.scheduleId ?? null, kind: params.kind, storage_path: params.storagePath })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function findById(id: string): Promise<PatientMedia | null> {
  const { data, error } = await getSupabaseClient().from("patient_media").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("patient_media").delete().eq("id", id);
  if (error) throw error;
}
