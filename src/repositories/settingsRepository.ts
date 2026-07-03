import { getSupabaseClient } from "../integrations/supabaseClient";
import { BusinessHourRow, ClinicSettings } from "../types";

export async function getClinicSettings(): Promise<ClinicSettings> {
  const { data, error } = await getSupabaseClient().from("clinic_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateClinicSettings(params: Partial<{ name: string; phone: string | null; email: string | null; address: string | null }>): Promise<ClinicSettings> {
  const { data, error } = await getSupabaseClient()
    .from("clinic_settings")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getBusinessHours(): Promise<BusinessHourRow[]> {
  const { data, error } = await getSupabaseClient().from("business_hours").select("*").order("weekday", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateBusinessHours(rows: BusinessHourRow[]): Promise<BusinessHourRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("business_hours")
    .upsert(rows, { onConflict: "weekday" })
    .select("*")
    .order("weekday", { ascending: true });

  if (error) throw error;
  return data || [];
}
