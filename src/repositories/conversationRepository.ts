import { getSupabaseClient } from "../integrations/supabaseClient";
import { Conversation, ConversationFlowState, ConversationStatus, FlowStateData, Message, MessageRole } from "../types";

export async function findActiveConversation(userId: string): Promise<Conversation | null> {
  const { data, error } = await getSupabaseClient()
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createConversation(userId: string): Promise<Conversation> {
  const { data, error } = await getSupabaseClient()
    .from("conversations")
    .insert({ user_id: userId, status: "ai" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function findOrCreateActiveConversation(userId: string): Promise<Conversation> {
  const existing = await findActiveConversation(userId);
  if (existing) return existing;
  return createConversation(userId);
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
}

export async function setPriority(conversationId: string, priority: boolean): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("conversations")
    .update({ priority, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
}

export async function updateConversationFlow(
  conversationId: string,
  state: ConversationFlowState,
  stateData: FlowStateData
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("conversations")
    .update({ state, state_data: stateData, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
}

/**
 * Registra atividade do cliente: reinicia o timer de inatividade e, se a
 * conversa estava encerrada por inatividade, reabre para "ai".
 */
export async function touchUserActivity(conversationId: string, reopenIfClosed: boolean): Promise<void> {
  const update: Record<string, unknown> = {
    last_user_message_at: new Date().toISOString(),
    nudge_sent_at: null,
    updated_at: new Date().toISOString(),
  };
  if (reopenIfClosed) update.status = "ai";

  const { error } = await getSupabaseClient().from("conversations").update(update).eq("id", conversationId);
  if (error) throw error;
}

export interface ConversationWithPhone extends Conversation {
  phone: string;
}

export async function findConversationsNeedingNudge(thresholdMinutes: number): Promise<ConversationWithPhone[]> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseClient()
    .from("conversations")
    .select("*, users(phone)")
    .eq("status", "ai")
    .is("nudge_sent_at", null)
    .not("last_user_message_at", "is", null)
    .lte("last_user_message_at", cutoff);

  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row, phone: row.users?.phone }));
}

export async function findConversationsNeedingClose(thresholdMinutes: number): Promise<ConversationWithPhone[]> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseClient()
    .from("conversations")
    .select("*, users(phone)")
    .eq("status", "ai")
    .not("nudge_sent_at", "is", null)
    .lte("nudge_sent_at", cutoff);

  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row, phone: row.users?.phone }));
}

export async function markNudgeSent(conversationId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("conversations")
    .update({ nudge_sent_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  automated = false
): Promise<Message> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .insert({ conversation_id: conversationId, role, content, automated })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export interface ConversationSummary extends Conversation {
  userName: string;
  userPhone: string;
  lastMessage: string | null;
}

/** Usado pelo Dashboard do CRM web (widget de conversas recentes). */
export async function listRecent(limit = 5): Promise<ConversationSummary[]> {
  const { data, error } = await getSupabaseClient()
    .from("conversations")
    .select("*, users(name, phone)")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const summaries: ConversationSummary[] = [];
  for (const row of (data || []) as any[]) {
    const { data: lastMsg } = await getSupabaseClient()
      .from("messages")
      .select("content")
      .eq("conversation_id", row.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    summaries.push({ ...row, userName: row.users?.name, userPhone: row.users?.phone, lastMessage: lastMsg?.content ?? null });
  }
  return summaries;
}

/** Usado pela tela de Conversas do CRM web (lista paginada). */
export async function listConversations(params: { limit?: number; offset?: number } = {}): Promise<{ items: ConversationSummary[]; total: number }> {
  const limit = params.limit ?? 30;
  const offset = params.offset ?? 0;

  const { data, error, count } = await getSupabaseClient()
    .from("conversations")
    .select("*, users(name, phone)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const items: ConversationSummary[] = [];
  for (const row of (data || []) as any[]) {
    const { data: lastMsg } = await getSupabaseClient()
      .from("messages")
      .select("content")
      .eq("conversation_id", row.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    items.push({ ...row, userName: row.users?.name, userPhone: row.users?.phone, lastMessage: lastMsg?.content ?? null });
  }
  return { items, total: count ?? 0 };
}

export async function findConversationById(id: string): Promise<ConversationSummary | null> {
  const { data, error } = await getSupabaseClient()
    .from("conversations")
    .select("*, users(name, phone)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row: any = data;
  return { ...row, userName: row.users?.name, userPhone: row.users?.phone, lastMessage: null };
}

/** Usado pela tela WhatsApp do CRM (card de estatisticas). */
export async function countActive(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .neq("status", "closed");

  if (error) throw error;
  return count ?? 0;
}

/** Usado pelo Dashboard do CRM (KPI "conversas aguardando"). */
export async function countByStatus(status: ConversationStatus): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("status", status);

  if (error) throw error;
  return count ?? 0;
}

export async function listMessages(conversationId: string, limit = 30): Promise<Message[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
