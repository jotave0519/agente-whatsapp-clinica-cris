import { getSupabaseClient } from "../integrations/supabaseClient";
import { User } from "../types";

export async function findUserByPhone(phone: string): Promise<User | null> {
  const { data, error } = await getSupabaseClient()
    .from("users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createUser(phone: string, name: string): Promise<User> {
  const { data, error } = await getSupabaseClient()
    .from("users")
    .insert({ phone, name })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function findOrCreateUser(phone: string, fallbackName: string): Promise<User> {
  const existing = await findUserByPhone(phone);
  if (existing) return existing;
  return createUser(phone, fallbackName || "");
}

export async function count(): Promise<number> {
  const { count, error } = await getSupabaseClient().from("users").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function findById(id: string): Promise<User | null> {
  const { data, error } = await getSupabaseClient().from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Usado pela tela de Pacientes do CRM web. */
export async function listAll(params: { search?: string; limit?: number; offset?: number }): Promise<{ items: User[]; total: number }> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  let query = getSupabaseClient()
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%,email.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data || [], total: count ?? 0 };
}

/** Criacao manual pelo CRM (agendamento manual / cadastro direto de paciente). */
export async function createPatient(params: { name: string; phone: string; email?: string | null }): Promise<User> {
  const { data, error } = await getSupabaseClient()
    .from("users")
    .insert({ name: params.name, phone: params.phone, email: params.email ?? null })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** Exclusao definitiva. Cascade em schedules/conversations/messages ja garantido pelo schema. */
export async function deleteUser(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("users").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePatient(
  id: string,
  params: Partial<{ name: string; phone: string; email: string | null; active: boolean }>
): Promise<User> {
  const { data, error } = await getSupabaseClient()
    .from("users")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
