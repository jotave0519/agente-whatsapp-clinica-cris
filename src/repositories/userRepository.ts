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
  return createUser(phone, fallbackName || phone);
}
