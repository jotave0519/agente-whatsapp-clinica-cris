import { getSupabaseClient } from "../integrations/supabaseClient";
import { PatientNote } from "../types";

export async function findByUserId(userId: string): Promise<PatientNote[]> {
  const { data, error } = await getSupabaseClient().from("patient_notes").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function create(userId: string, body: string, authorStaffId: string | null): Promise<PatientNote> {
  const { data, error } = await getSupabaseClient()
    .from("patient_notes")
    .insert({ user_id: userId, body, author_staff_id: authorStaffId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("patient_notes").delete().eq("id", id);
  if (error) throw error;
}
