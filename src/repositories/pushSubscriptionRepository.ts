import { getSupabaseClient } from "../integrations/supabaseClient";
import { PushSubscriptionRecord } from "../types";

export async function upsert(params: {
  staffId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<PushSubscriptionRecord> {
  const { data, error } = await getSupabaseClient()
    .from("push_subscriptions")
    .upsert(
      {
        staff_id: params.staffId,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        user_agent: params.userAgent ?? null,
      },
      { onConflict: "endpoint" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function removeByEndpoint(endpoint: string): Promise<void> {
  const { error } = await getSupabaseClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}

export async function findAll(): Promise<PushSubscriptionRecord[]> {
  const { data, error } = await getSupabaseClient().from("push_subscriptions").select("*");
  if (error) throw error;
  return data || [];
}

export async function findByStaffId(staffId: string): Promise<PushSubscriptionRecord[]> {
  const { data, error } = await getSupabaseClient().from("push_subscriptions").select("*").eq("staff_id", staffId);
  if (error) throw error;
  return data || [];
}
