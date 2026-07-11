import { getSupabaseClient } from "../integrations/supabaseClient";
import { FaqItem } from "../types";

export async function listAll(): Promise<FaqItem[]> {
  const { data, error } = await getSupabaseClient().from("faq_items").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Usado pela IA: so perguntas ativas e com resposta preenchida. */
export async function listActiveAnswered(): Promise<FaqItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("faq_items")
    .select("*")
    .eq("active", true)
    .neq("answer", "")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function create(params: { question: string; answer?: string; active?: boolean; sort_order?: number }): Promise<FaqItem> {
  const { data, error } = await getSupabaseClient()
    .from("faq_items")
    .insert({ answer: "", active: true, sort_order: 0, ...params })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function update(
  id: string,
  params: Partial<{ question: string; answer: string; active: boolean; sort_order: number }>
): Promise<FaqItem> {
  const { data, error } = await getSupabaseClient()
    .from("faq_items")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("faq_items").delete().eq("id", id);
  if (error) throw error;
}
