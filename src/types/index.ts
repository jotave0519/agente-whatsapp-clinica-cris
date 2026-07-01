export interface User {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export type ScheduleStatus = "Agendado" | "Cancelado" | "Concluido";

export interface Schedule {
  id: string;
  user_id: string;
  patient_name: string;
  phone: string;
  procedure: string;
  date: string;
  time: string;
  google_event_id: string | null;
  status: ScheduleStatus;
  reminder_sent: boolean;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export type ConversationStatus = "ai" | "human" | "closed";

export interface Conversation {
  id: string;
  user_id: string;
  status: ConversationStatus;
  last_user_message_at: string | null;
  nudge_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface IncomingWhatsAppMessage {
  phone: string;
  text: string;
  pushName?: string;
}

