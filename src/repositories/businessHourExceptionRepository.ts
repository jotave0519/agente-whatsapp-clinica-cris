import { getSupabaseClient } from "../integrations/supabaseClient";
import { BusinessHourException } from "../types";

export async function listAll(): Promise<BusinessHourException[]> {
  const { data, error } = await getSupabaseClient().from("business_hour_exceptions").select("*").order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function findByDate(date: string): Promise<BusinessHourException | null> {
  const { data, error } = await getSupabaseClient().from("business_hour_exceptions").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(params: {
  date: string;
  type: "holiday" | "block" | "special";
  closed?: boolean;
  open_time?: string | null;
  close_time?: string | null;
  note?: string | null;
}): Promise<BusinessHourException> {
  const { data, error } = await getSupabaseClient()
    .from("business_hour_exceptions")
    .insert({ closed: true, ...params })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("business_hour_exceptions").delete().eq("id", id);
  if (error) throw error;
}
