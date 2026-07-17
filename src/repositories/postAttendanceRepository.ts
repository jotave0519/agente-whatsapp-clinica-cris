import { getSupabaseClient } from "../integrations/supabaseClient";
import {
  PostAttendanceEnrollment,
  PostAttendanceEnrollmentStatus,
  PostAttendanceFlow,
  PostAttendanceFlowMessage,
  PostAttendanceTriggerSource,
} from "../types";

export async function listFlows(): Promise<PostAttendanceFlow[]> {
  const { data, error } = await getSupabaseClient().from("post_attendance_flows").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listActiveFlows(): Promise<PostAttendanceFlow[]> {
  const { data, error } = await getSupabaseClient().from("post_attendance_flows").select("*").eq("active", true);
  if (error) throw error;
  return data || [];
}

export async function findFlowById(id: string): Promise<PostAttendanceFlow | null> {
  const { data, error } = await getSupabaseClient().from("post_attendance_flows").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createFlow(params: { name: string; procedure_match: string; active?: boolean }): Promise<PostAttendanceFlow> {
  const { data, error } = await getSupabaseClient().from("post_attendance_flows").insert(params).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateFlow(id: string, params: Partial<{ name: string; procedure_match: string; active: boolean }>): Promise<PostAttendanceFlow> {
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_flows")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFlow(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("post_attendance_flows").delete().eq("id", id);
  if (error) throw error;
}

export async function listFlowMessages(flowId: string): Promise<PostAttendanceFlowMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_flow_messages")
    .select("*")
    .eq("flow_id", flowId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function findFlowMessageById(id: string): Promise<PostAttendanceFlowMessage | null> {
  const { data, error } = await getSupabaseClient().from("post_attendance_flow_messages").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listFlowMessagesByFlowIds(flowIds: string[]): Promise<PostAttendanceFlowMessage[]> {
  if (flowIds.length === 0) return [];
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_flow_messages")
    .select("*")
    .in("flow_id", flowIds)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Substitui a lista de mensagens de um fluxo inteira (delete-all + insert) - mais simples e seguro que CRUD granular por mensagem, dado que a UI sempre edita o fluxo completo de uma vez. */
export async function replaceFlowMessages(
  flowId: string,
  messages: { delay_value: number; delay_unit: "hours" | "days"; message_type: "simple" | "question" | "review" | "reminder"; body: string }[]
): Promise<void> {
  const client = getSupabaseClient();
  const { error: delErr } = await client.from("post_attendance_flow_messages").delete().eq("flow_id", flowId);
  if (delErr) throw delErr;
  if (messages.length === 0) return;

  const { error: insErr } = await client.from("post_attendance_flow_messages").insert(
    messages.map((m, idx) => ({
      flow_id: flowId,
      sequence: idx + 1,
      delay_value: m.delay_value,
      delay_unit: m.delay_unit,
      message_type: m.message_type,
      body: m.body,
    }))
  );
  if (insErr) throw insErr;
}

export async function findFlowByProcedure(procedure: string): Promise<PostAttendanceFlow | null> {
  const flows = await listActiveFlows();
  if (flows.length === 0) return null;

  const target = procedure.toLowerCase();
  const exact = flows.find((f) => f.procedure_match.toLowerCase() === target);
  if (exact) return exact;

  const substring = flows.find(
    (f) => f.procedure_match !== "all" && (target.includes(f.procedure_match.toLowerCase()) || f.procedure_match.toLowerCase().includes(target))
  );
  if (substring) return substring;

  return flows.find((f) => f.procedure_match === "all") ?? null;
}

export async function findEnrollmentById(id: string): Promise<PostAttendanceEnrollment | null> {
  const { data, error } = await getSupabaseClient().from("post_attendance_enrollments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findEnrollmentByScheduleId(scheduleId: string): Promise<PostAttendanceEnrollment | null> {
  const { data, error } = await getSupabaseClient().from("post_attendance_enrollments").select("*").eq("schedule_id", scheduleId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Insere um enrollment novo, ignorando se ja existe pra esse schedule (guardado por unique(schedule_id)) - protege a corrida entre o hook manual e o cron de tempo-decorrido. Retorna null se ja existia. */
export async function createEnrollmentIfMissing(params: {
  scheduleId: string;
  flowId: string;
  userId: string;
  triggerSource: PostAttendanceTriggerSource;
}): Promise<PostAttendanceEnrollment | null> {
  const { data, error } = await getSupabaseClient()
    .from("post_attendance_enrollments")
    .upsert(
      [{ schedule_id: params.scheduleId, flow_id: params.flowId, user_id: params.userId, trigger_source: params.triggerSource }],
      { onConflict: "schedule_id", ignoreDuplicates: true }
    )
    .select("*");
  if (error) throw error;
  return (data || [])[0] ?? null;
}

export async function setEnrollmentStatus(id: string, status: PostAttendanceEnrollmentStatus): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("post_attendance_enrollments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export interface ListEnrollmentsParams {
  status?: PostAttendanceEnrollmentStatus;
  limit?: number;
  offset?: number;
}

export interface EnrollmentWithContext extends PostAttendanceEnrollment {
  patientName: string;
  procedure: string;
  flowName: string;
}

/** Usado pela aba Historico do CRM. */
export async function listEnrollments(params: ListEnrollmentsParams = {}): Promise<{ items: EnrollmentWithContext[]; total: number }> {
  const limit = params.limit ?? 30;
  const offset = params.offset ?? 0;

  let query = getSupabaseClient()
    .from("post_attendance_enrollments")
    .select("*, schedules(patient_name, procedure), post_attendance_flows(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) query = query.eq("status", params.status);

  const { data, error, count } = await query;
  if (error) throw error;

  const items: EnrollmentWithContext[] = (data || []).map((row: any) => ({
    ...row,
    patientName: row.schedules?.patient_name ?? "",
    procedure: row.schedules?.procedure ?? "",
    flowName: row.post_attendance_flows?.name ?? "",
  }));

  return { items, total: count ?? 0 };
}

export async function countEnrollmentsSince(sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("post_attendance_enrollments")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}
