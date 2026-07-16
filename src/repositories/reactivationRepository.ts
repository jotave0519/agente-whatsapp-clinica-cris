import { getSupabaseClient } from "../integrations/supabaseClient";
import { ReactivationCampaign, ReactivationTarget, ReactivationTargetStatus } from "../types";

const NON_TERMINAL_STATUSES: ReactivationTargetStatus[] = ["pending", "awaiting_response"];

export async function listCampaigns(): Promise<ReactivationCampaign[]> {
  const { data, error } = await getSupabaseClient().from("reactivation_campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function findCampaignById(id: string): Promise<ReactivationCampaign | null> {
  const { data, error } = await getSupabaseClient().from("reactivation_campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listActiveCampaigns(): Promise<ReactivationCampaign[]> {
  const { data, error } = await getSupabaseClient().from("reactivation_campaigns").select("*").eq("active", true);
  if (error) throw error;
  return data || [];
}

export type CampaignInput = Omit<ReactivationCampaign, "id" | "created_at" | "updated_at">;

export async function createCampaign(params: Partial<CampaignInput> & { name: string; segment_type: string; inactive_days: number }): Promise<ReactivationCampaign> {
  const { data, error } = await getSupabaseClient().from("reactivation_campaigns").insert(params).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(id: string, params: Partial<CampaignInput>): Promise<ReactivationCampaign> {
  const { data, error } = await getSupabaseClient()
    .from("reactivation_campaigns")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("reactivation_campaigns").delete().eq("id", id);
  if (error) throw error;
}

/** Usuarios que ja tem um target NAO-TERMINAL em qualquer campanha - usado pra nao duplicar entre campanhas. */
export async function findUserIdsWithActiveTarget(): Promise<Set<string>> {
  const { data, error } = await getSupabaseClient().from("reactivation_targets").select("user_id").in("status", NON_TERMINAL_STATUSES);
  if (error) throw error;
  return new Set((data || []).map((r) => r.user_id));
}

/**
 * Insere targets novos, ignorando quem ja tem linha pra essa campanha
 * (guardado por unique(campaign_id,user_id)) - nunca reseta um target ja
 * terminal (declined/converted/ignored) de volta pra pending. Retorna só as
 * linhas REALMENTE inseridas agora (o `ignoreDuplicates` faz o PostgREST
 * devolver, com `.select()`, apenas as linhas novas) - usado pelo chamador
 * pra saber pra quais targets precisa agendar a mensagem inicial.
 */
export async function insertTargetsIfMissing(
  rows: { campaignId: string; userId: string; lastProcedure: string | null; daysInactive: number }[]
): Promise<ReactivationTarget[]> {
  if (rows.length === 0) return [];
  const { data, error } = await getSupabaseClient()
    .from("reactivation_targets")
    .upsert(
      rows.map((r) => ({
        campaign_id: r.campaignId,
        user_id: r.userId,
        last_procedure: r.lastProcedure,
        days_inactive_at_enrollment: r.daysInactive,
      })),
      { onConflict: "campaign_id,user_id", ignoreDuplicates: true }
    )
    .select("*");
  if (error) throw error;
  return data || [];
}

export async function findTargetById(id: string): Promise<ReactivationTarget | null> {
  const { data, error } = await getSupabaseClient().from("reactivation_targets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setTargetStatus(id: string, status: ReactivationTargetStatus, extra?: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("reactivation_targets")
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Targets pendentes de decisao (pending/awaiting_response) - usado pelo cron de envio pra revalidar/checar conversao. */
export async function findNonTerminalTargets(): Promise<ReactivationTarget[]> {
  const { data, error } = await getSupabaseClient().from("reactivation_targets").select("*").in("status", NON_TERMINAL_STATUSES);
  if (error) throw error;
  return data || [];
}

export async function listTargetsByCampaign(campaignId: string): Promise<ReactivationTarget[]> {
  const { data, error } = await getSupabaseClient()
    .from("reactivation_targets")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function countEligible(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("reactivation_targets")
    .select("*", { count: "exact", head: true })
    .in("status", NON_TERMINAL_STATUSES);
  if (error) throw error;
  return count ?? 0;
}

export async function countActiveCampaigns(): Promise<number> {
  const { count, error } = await getSupabaseClient().from("reactivation_campaigns").select("*", { count: "exact", head: true }).eq("active", true);
  if (error) throw error;
  return count ?? 0;
}

/** Usado pelo Dashboard - contagem de targets por status, entre TODAS as campanhas (nao so a ativa/nao-terminal). */
export async function countAllByStatus(): Promise<Record<ReactivationTargetStatus, number>> {
  const { data, error } = await getSupabaseClient().from("reactivation_targets").select("status");
  if (error) throw error;
  const counts: Record<ReactivationTargetStatus, number> = {
    pending: 0,
    awaiting_response: 0,
    responded: 0,
    ignored: 0,
    converted: 0,
    declined: 0,
    excluded: 0,
    failed: 0,
  };
  for (const row of data || []) counts[row.status as ReactivationTargetStatus] += 1;
  return counts;
}

/**
 * Estimativa de receita recuperada: soma das transacoes (receita, pagas) de
 * pacientes com target 'converted', ocorridas numa janela de 60 dias apos o
 * envio da mensagem inicial daquele target. E uma estimativa por atribuicao,
 * nao causalidade garantida - rotulado como tal na UI.
 */
export async function estimateRecoveredRevenue(): Promise<number> {
  const client = getSupabaseClient();
  const { data: converted, error } = await client.from("reactivation_targets").select("id, user_id").eq("status", "converted");
  if (error) throw error;
  if (!converted || converted.length === 0) return 0;

  const targetIds = converted.map((t) => t.id);
  const { data: messages, error: msgErr } = await client
    .from("reactivation_messages")
    .select("target_id, sent_at")
    .in("target_id", targetIds)
    .eq("tier", "initial");
  if (msgErr) throw msgErr;
  const sentAtByTarget = new Map<string, string>((messages || []).map((m) => [m.target_id, m.sent_at]));

  const userIds = [...new Set(converted.map((t) => t.user_id))];
  const { data: transactions, error: txErr } = await client
    .from("transactions")
    .select("patient_id, amount, occurred_on")
    .in("patient_id", userIds)
    .eq("type", "receita")
    .eq("status", "pago");
  if (txErr) throw txErr;

  let total = 0;
  for (const target of converted) {
    const sentAt = sentAtByTarget.get(target.id);
    if (!sentAt) continue;
    const windowStart = new Date(sentAt);
    const windowEnd = new Date(windowStart.getTime() + 60 * 24 * 3600_000);

    for (const tx of transactions || []) {
      if (tx.patient_id !== target.user_id) continue;
      const occurred = new Date(`${tx.occurred_on}T12:00:00-03:00`);
      if (occurred >= windowStart && occurred <= windowEnd) total += Number(tx.amount);
    }
  }
  return total;
}
