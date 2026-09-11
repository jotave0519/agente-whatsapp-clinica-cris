import { getSupabaseClient } from "../integrations/supabaseClient";
import { NotificationRecord, NotificationType } from "../types";

export async function create(params: {
  staffId: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduleId?: string | null;
}): Promise<NotificationRecord> {
  const { data, error } = await getSupabaseClient()
    .from("notifications")
    .insert({
      staff_id: params.staffId,
      type: params.type,
      title: params.title,
      body: params.body,
      schedule_id: params.scheduleId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listByStaffId(staffId: string, limit = 30): Promise<NotificationRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("notifications")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function countUnread(staffId: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("staff_id", staffId)
    .eq("read", false);

  if (error) throw error;
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllRead(staffId: string): Promise<void> {
  const { error } = await getSupabaseClient().from("notifications").update({ read: true }).eq("staff_id", staffId).eq("read", false);
  if (error) throw error;
}
