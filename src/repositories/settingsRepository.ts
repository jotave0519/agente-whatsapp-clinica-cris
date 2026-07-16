import { getSupabaseClient } from "../integrations/supabaseClient";
import { BusinessHourRow, ClinicSettings } from "../types";

export async function getClinicSettings(): Promise<ClinicSettings> {
  const { data, error } = await getSupabaseClient().from("clinic_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateClinicSettings(
  params: Partial<{
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    reminders_enabled: boolean;
    confirmation_enabled: boolean;
    confirmation_hours_before: number;
    confirmation_nudges_enabled: boolean;
    confirmation_nudge_count: number;
    confirmation_nudge_interval_hours: number;
    inactivity_nudge_enabled: boolean;
    responsible_name: string | null;
    specialty: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    whatsapp: string | null;
    instagram: string | null;
    website: string | null;
    general_notes: string | null;
    about_text: string | null;
    context_expiry_minutes: number;
  }>
): Promise<ClinicSettings> {
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
