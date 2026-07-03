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

export type ConversationFlowState =
  | "MENU"
  | "SCHEDULING_PROCEDURE"
  | "SCHEDULING_NAME"
  | "SCHEDULING_DATE"
  | "SCHEDULING_TIME"
  | "SCHEDULING_CONFIRM"
  | "RESCHEDULING_SELECT"
  | "RESCHEDULING_DATE"
  | "RESCHEDULING_TIME"
  | "RESCHEDULING_CONFIRM"
  | "CANCELING_SELECT"
  | "CANCELING_CONFIRM";

export interface FlowStateData {
  name?: string;
  procedure?: string;
  durationMinutes?: number;
  date?: string;
  availableSlots?: string[];
  selectedStart?: string;
  scheduleId?: string;
  candidates?: { scheduleId: string; procedure: string; date: string; time: string }[];
}

export interface Conversation {
  id: string;
  user_id: string;
  status: ConversationStatus;
  state: ConversationFlowState;
  state_data: FlowStateData;
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

export interface Procedure {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  duration_minutes: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type StaffRole = "admin" | "recepcionista" | "profissional";

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  created_at: string;
  updated_at: string;
}

