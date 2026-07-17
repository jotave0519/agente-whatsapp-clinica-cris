import { getSupabaseClient } from "../integrations/supabaseClient";
import { PostAttendanceEvent, PostAttendanceEventType } from "../types";

export async function record(enrollmentId: string, eventType: PostAttendanceEventType, detail?: string | null): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("post_attendance_events")
    .insert({ enrollment_id: enrollmentId, event_type: eventType, detail: detail ?? null });
  if (error) throw error;
}

export async function findByEnrollmentIds(enrollmentIds: string[]): Promise<PostAttendanceEvent[]> {
  if (enrollmentIds.length === 0) return [];
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_events")
    .select("*")
    .in("enrollment_id", enrollmentIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Usado pelo paciente com historico (heuristica de horario aprendido): horarios de eventos 'responded' de matriculas anteriores desse paciente. */
export async function findRespondedHoursForUser(userId: string): Promise<number[]> {
  const client = getSupabaseClient();
  const { data: enrollments, error: enrollErr } = await client.from("post_attendance_enrollments").select("id").eq("user_id", userId);
  if (enrollErr) throw enrollErr;
  const enrollmentIds = (enrollments || []).map((e) => e.id);
  if (enrollmentIds.length === 0) return [];

  const { data, error } = await client
    .from("post_attendance_events")
    .select("created_at")
    .eq("event_type", "responded")
    .in("enrollment_id", enrollmentIds);
  if (error) throw error;

  return (data || []).map((row: any) => {
    const spTime = new Date(row.created_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour12: false, hour: "2-digit" });
    return parseInt(spTime, 10);
  });
}

/** Usado pelo Dashboard - eventos por tipo/periodo, com o enrollment de origem (permite correlacionar review_requested -> responded do mesmo enrollment). */
export async function findByTypeSince(
  eventTypes: PostAttendanceEventType[],
  sinceIso: string
): Promise<{ enrollment_id: string; event_type: PostAttendanceEventType; created_at: string }[]> {
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_events")
    .select("enrollment_id, event_type, created_at")
    .in("event_type", eventTypes)
    .gte("created_at", sinceIso);
  if (error) throw error;
  return data || [];
}
