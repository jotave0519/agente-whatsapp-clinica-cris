import { getSupabaseClient } from "../integrations/supabaseClient";
import { MessageTemplate } from "../types";

export async function listAll(): Promise<MessageTemplate[]> {
  const { data, error } = await getSupabaseClient().from("message_templates").select("*").order("key", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getByKey(key: string): Promise<MessageTemplate | null> {
  const { data, error } = await getSupabaseClient().from("message_templates").select("*").eq("key", key).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateBody(key: string, body: string): Promise<MessageTemplate> {
  const { data, error } = await getSupabaseClient()
    .from("message_templates")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
