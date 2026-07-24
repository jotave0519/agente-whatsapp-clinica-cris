import { getSupabaseClient } from "../integrations/supabaseClient";
import { PatientDocument } from "../types";

export async function findByUserId(userId: string): Promise<PatientDocument[]> {
  const { data, error } = await getSupabaseClient().from("patient_documents").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function create(params: { userId: string; name: string; category?: string | null; storagePath: string }): Promise<PatientDocument> {
  const { data, error } = await getSupabaseClient()
    .from("patient_documents")
    .insert({ user_id: params.userId, name: params.name, category: params.category ?? null, storage_path: params.storagePath })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function findById(id: string): Promise<PatientDocument | null> {
  const { data, error } = await getSupabaseClient().from("patient_documents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("patient_documents").delete().eq("id", id);
  if (error) throw error;
}
