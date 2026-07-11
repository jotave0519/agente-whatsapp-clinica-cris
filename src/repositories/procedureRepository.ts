import { getSupabaseClient } from "../integrations/supabaseClient";
import { Procedure } from "../types";

export async function listAll(): Promise<Procedure[]> {
  const { data, error } = await getSupabaseClient().from("procedures").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function findById(id: string): Promise<Procedure | null> {
  const { data, error } = await getSupabaseClient().from("procedures").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(params: {
  name: string;
  category?: string | null;
  price?: number | null;
  description?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  pre_instructions?: string | null;
  post_instructions?: string | null;
  active?: boolean;
}): Promise<Procedure> {
  const { data, error } = await getSupabaseClient()
    .from("procedures")
    .insert({ active: true, ...params })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function update(
  id: string,
  params: Partial<{
    name: string;
    category: string | null;
    price: number | null;
    description: string | null;
    duration_minutes: number | null;
    notes: string | null;
    pre_instructions: string | null;
    post_instructions: string | null;
    active: boolean;
  }>
): Promise<Procedure> {
  const { data, error } = await getSupabaseClient()
    .from("procedures")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("procedures").delete().eq("id", id);
  if (error) throw error;
}
