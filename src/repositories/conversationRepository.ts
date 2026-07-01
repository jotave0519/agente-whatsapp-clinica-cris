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
  content: string
): Promise<Message> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .insert({ conversation_id: conversationId, role, content })
    .select("*")
    .single();

  if (error) throw error;
  return data;
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
