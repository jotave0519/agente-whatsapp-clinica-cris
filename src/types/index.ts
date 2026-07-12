export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  active: boolean;
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
  notes: string | null;
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
  | "CANCELING_CONFIRM"
  | "CLINIC_CANCELLED_OFFER";

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
  notes: string | null;
  pre_instructions: string | null;
  post_instructions: string | null;
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
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type TransactionType = "receita" | "despesa";
export type TransactionStatus = "pago" | "pendente";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  category: string | null;
  amount: number;
  method: string | null;
  status: TransactionStatus;
  patient_id: string | null;
  procedure_id: string | null;
  occurred_on: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  min_quantity: number;
  expiry_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type InventoryMovementType = "entrada" | "saida";

export interface InventoryMovement {
  id: string;
  item_id: string;
  type: InventoryMovementType;
  quantity: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ClinicSettings {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  reminders_enabled: boolean;
  inactivity_nudge_enabled: boolean;
  responsible_name: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  general_notes: string | null;
  about_text: string | null;
  context_expiry_minutes: number;
  updated_at: string;
}

export interface BusinessHourRow {
  weekday: number;
  enabled: boolean;
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
}

export type BusinessHourExceptionType = "holiday" | "block" | "special";

export interface BusinessHourException {
  id: string;
  date: string;
  type: BusinessHourExceptionType;
  closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  key: string;
  label: string;
  body: string;
  updated_at: string;
}

