import { getSupabaseClient } from "../integrations/supabaseClient";
import { Staff, StaffRole } from "../types";

export async function findById(id: string): Promise<Staff | null> {
  const { data, error } = await getSupabaseClient().from("staff").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(id: string, name: string, email: string, role: StaffRole): Promise<Staff> {
  const { data, error } = await getSupabaseClient()
    .from("staff")
    .insert({ id, name, email, role })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
