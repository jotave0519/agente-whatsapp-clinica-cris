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

/** Usado pela tela de Usuarios do CRM web (somente admin). */
export async function listAll(): Promise<Staff[]> {
  const { data, error } = await getSupabaseClient().from("staff").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function update(id: string, params: Partial<{ role: StaffRole; active: boolean }>): Promise<Staff> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.role !== undefined) payload.role = params.role;
  if (params.active !== undefined) payload.active = params.active;

  const { data, error } = await getSupabaseClient().from("staff").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}
