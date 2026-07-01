import { getSupabaseClient } from "../integrations/supabaseClient";
import { Conversation, ConversationStatus, Message, MessageRole } from "../types";

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
