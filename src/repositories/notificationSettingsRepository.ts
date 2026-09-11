import { getSupabaseClient } from "../integrations/supabaseClient";
import { NotificationSettings } from "../types";

const DEFAULTS: Omit<NotificationSettings, "staff_id" | "updated_at"> = {
  reminders_enabled: true,
  reminder_minutes_before: 10,
  new_appointment_enabled: true,
  changes_enabled: true,
  cancellations_enabled: true,
};

/** Sem linha salva ainda = usa os padroes (tudo ligado, lembrete 10min antes) - nunca precisa de seed. */
export async function findByStaffId(staffId: string): Promise<NotificationSettings> {
  const { data, error } = await getSupabaseClient().from("notification_settings").select("*").eq("staff_id", staffId).maybeSingle();
  if (error) throw error;
  return data || { staff_id: staffId, updated_at: new Date().toISOString(), ...DEFAULTS };
}

export async function findByStaffIds(staffIds: string[]): Promise<Record<string, NotificationSettings>> {
  if (staffIds.length === 0) return {};
  const { data, error } = await getSupabaseClient().from("notification_settings").select("*").in("staff_id", staffIds);
  if (error) throw error;
  const byId: Record<string, NotificationSettings> = {};
  for (const id of staffIds) byId[id] = { staff_id: id, updated_at: new Date().toISOString(), ...DEFAULTS };
  for (const row of data || []) byId[row.staff_id] = row;
  return byId;
}

export async function upsert(
  staffId: string,
  params: Partial<Omit<NotificationSettings, "staff_id" | "updated_at">>
): Promise<NotificationSettings> {
  const current = await findByStaffId(staffId);
  const { data, error } = await getSupabaseClient()
    .from("notification_settings")
    .upsert(
      {
        staff_id: staffId,
        reminders_enabled: params.reminders_enabled ?? current.reminders_enabled,
        reminder_minutes_before: params.reminder_minutes_before ?? current.reminder_minutes_before,
        new_appointment_enabled: params.new_appointment_enabled ?? current.new_appointment_enabled,
        changes_enabled: params.changes_enabled ?? current.changes_enabled,
        cancellations_enabled: params.cancellations_enabled ?? current.cancellations_enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
