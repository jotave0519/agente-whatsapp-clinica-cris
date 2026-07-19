import { getSupabaseClient } from "../integrations/supabaseClient";
import { BusinessHourSlot } from "../types";

export async function listAll(): Promise<BusinessHourSlot[]> {
  const { data, error } = await getSupabaseClient()
    .from("business_hour_slots")
    .select("*")
    .order("weekday", { ascending: true })
    .order("time", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function create(weekday: number, time: string): Promise<BusinessHourSlot> {
  const { data, error } = await getSupabaseClient()
    .from("business_hour_slots")
    .insert({ weekday, time })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("business_hour_slots").delete().eq("id", id);
  if (error) throw error;
}
