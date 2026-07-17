import { getSupabaseClient } from "../integrations/supabaseClient";
import { CommercialOpportunity, CommercialOpportunityStage, CommercialSignalType } from "../types";

const NON_TERMINAL: CommercialOpportunityStage[] = [
  "new_interest",
  "evaluation_scheduled",
  "evaluation_done",
  "awaiting_decision",
  "follow_up_active",
  "procedure_scheduled",
];

export async function findById(id: string): Promise<CommercialOpportunity | null> {
  const { data, error } = await getSupabaseClient().from("commercial_opportunities").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findActiveByUserId(userId: string): Promise<CommercialOpportunity | null> {
  const { data, error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .select("*")
    .eq("user_id", userId)
    .in("stage", NON_TERMINAL)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Unica funcao de criacao usada pelos 4 pontos de deteccao de sinal - garante
 * no maximo 1 oportunidade nao-terminal por paciente. A checagem em codigo
 * (findActiveByUserId antes do insert) e o caminho normal; o indice unico
 * parcial no banco (idx_commercial_opportunities_one_active_per_user) e a
 * garantia real contra corrida - se dois pontos de deteccao criarem quase ao
 * mesmo tempo, o insert perdedor recebe unique_violation (23505) e re-busca a
 * linha que venceu, nunca duplica. Mesmo espirito de
 * reactivationRepository.findUserIdsWithActiveTarget (checagem em codigo) +
 * o indice parcial correspondente la, ja que aqui so ha uma dimensao
 * (user_id), sem um segundo par (campaign_id,user_id) pra fazer upsert
 * atomico de verdade via onConflict.
 */
export async function createOpportunityIfMissing(params: {
  userId: string;
  procedureInterest: string;
  sourceSignal: CommercialSignalType;
  signalNote: string | null;
}): Promise<{ opportunity: CommercialOpportunity; created: boolean }> {
  const existing = await findActiveByUserId(params.userId);
  if (existing) return { opportunity: existing, created: false };

  const { data, error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .insert({
      user_id: params.userId,
      procedure_interest: params.procedureInterest,
      source_signal: params.sourceSignal,
      signal_note: params.signalNote,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const raceWinner = await findActiveByUserId(params.userId);
      if (raceWinner) return { opportunity: raceWinner, created: false };
    }
    throw error;
  }
  return { opportunity: data, created: true };
}

/** Segundo sinal (ou mais) pro mesmo paciente enquanto ja existe uma oportunidade aberta - atualiza em vez de duplicar. */
export async function updateSignal(id: string, procedureInterest: string, signalNote: string | null): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ procedure_interest: procedureInterest, signal_note: signalNote, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setStage(id: string, stage: CommercialOpportunityStage, extra?: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ stage, ...extra, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function linkSchedule(id: string, scheduleId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ schedule_id: scheduleId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function clearSchedule(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ schedule_id: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setPaused(id: string, paused: boolean): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ paused, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function incrementAttempts(id: string, current: number): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ attempts_used: current + 1, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setResponse(id: string, responseBody: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ last_response_at: new Date().toISOString(), last_response_body: responseBody.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setMessageSent(id: string, body: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .update({ last_message_sent_at: new Date().toISOString(), last_message_body: body.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Usado pelo cron por minuto (checkOpportunityProgress) - todas as oportunidades ainda em jogo. */
export async function findNonTerminal(): Promise<CommercialOpportunity[]> {
  const { data, error } = await getSupabaseClient().from("commercial_opportunities").select("*").in("stage", NON_TERMINAL);
  if (error) throw error;
  return data || [];
}

export interface OpportunityWithContext extends CommercialOpportunity {
  patientName: string;
  patientPhone: string;
  conversationId: string | null;
  conversationStatus: "ai" | "human" | "closed" | null;
}

/** Usado pelo Kanban do CRM - todas as oportunidades (padrao: so as nao-terminais + terminais recentes) com nome/telefone/status de conversa. */
export async function listAll(params: { includeTerminalSinceIso?: string } = {}): Promise<OpportunityWithContext[]> {
  const client = getSupabaseClient();
  let query = client
    .from("commercial_opportunities")
    .select("*, users(name, phone)")
    .order("updated_at", { ascending: false });

  if (params.includeTerminalSinceIso) {
    query = query.or(`stage.in.(${NON_TERMINAL.join(",")}),updated_at.gte.${params.includeTerminalSinceIso}`);
  } else {
    query = query.in("stage", NON_TERMINAL);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as any[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: conversations } = await client.from("conversations").select("id, user_id, status").in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const conversationByUser = new Map<string, { id: string; status: "ai" | "human" | "closed" }>();
  for (const c of conversations || []) conversationByUser.set(c.user_id, { id: c.id, status: c.status });

  return rows.map((row) => {
    const conv = conversationByUser.get(row.user_id);
    return {
      ...row,
      patientName: row.users?.name ?? "",
      patientPhone: row.users?.phone ?? "",
      conversationId: conv?.id ?? null,
      conversationStatus: conv?.status ?? null,
    };
  });
}

export async function countByStage(): Promise<Record<CommercialOpportunityStage, number>> {
  const { data, error } = await getSupabaseClient().from("commercial_opportunities").select("stage");
  if (error) throw error;
  const counts: Record<CommercialOpportunityStage, number> = {
    new_interest: 0,
    evaluation_scheduled: 0,
    evaluation_done: 0,
    awaiting_decision: 0,
    follow_up_active: 0,
    procedure_scheduled: 0,
    converted: 0,
    lost: 0,
  };
  for (const row of data || []) counts[row.stage as CommercialOpportunityStage] += 1;
  return counts;
}

/** Usado pelo Dashboard. */
export async function countOpen(): Promise<number> {
  const { count, error } = await getSupabaseClient().from("commercial_opportunities").select("*", { count: "exact", head: true }).in("stage", NON_TERMINAL);
  if (error) throw error;
  return count ?? 0;
}

export async function countInFollowUp(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .select("*", { count: "exact", head: true })
    .eq("stage", "follow_up_active");
  if (error) throw error;
  return count ?? 0;
}

export async function countConvertedSince(sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .select("*", { count: "exact", head: true })
    .eq("stage", "converted")
    .gte("updated_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export async function countLostSince(sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .select("*", { count: "exact", head: true })
    .eq("stage", "lost")
    .gte("updated_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export async function sumEstimatedValueConvertedSince(sinceIso: string): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from("commercial_opportunities")
    .select("estimated_value")
    .eq("stage", "converted")
    .gte("updated_at", sinceIso);
  if (error) throw error;
  return (data || []).reduce((acc, row) => acc + Number(row.estimated_value ?? 0), 0);
}
