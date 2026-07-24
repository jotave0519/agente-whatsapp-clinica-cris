import { getSupabaseClient } from "../integrations/supabaseClient";
import { PatientGoal, PatientGoalStatus } from "../types";

export async function findByUserId(userId: string): Promise<PatientGoal[]> {
  const { data, error } = await getSupabaseClient().from("patient_goals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function create(userId: string, description: string): Promise<PatientGoal> {
  const { data, error } = await getSupabaseClient().from("patient_goals").insert({ user_id: userId, description }).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateStatus(id: string, status: PatientGoalStatus): Promise<PatientGoal> {
  const { data, error } = await getSupabaseClient()
    .from("patient_goals")
    .update({ status, completed_at: status === "concluido" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("patient_goals").delete().eq("id", id);
  if (error) throw error;
}
