export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  active: boolean;
  do_not_contact: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduleStatus = "Agendado" | "Cancelado" | "Concluido" | "Faltou";
export type ConfirmationStatus = "pending" | "awaiting" | "confirmed" | "cancelled";

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
  confirmation_status: ConfirmationStatus;
  confirmed_at: string | null;
  was_rescheduled: boolean;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

/** 'confirmation' (pedido inicial) ou 'nudge_N' (N-esimo lembrete de nao-resposta) - N e configuravel, nao um enum fixo. */
export type ReminderTier = string;
export type ReminderStatus = "pending" | "sending" | "sent" | "cancelled" | "failed";

export interface AppointmentReminder {
  id: string;
  schedule_id: string;
  tier: ReminderTier;
  scheduled_for: string;
  status: ReminderStatus;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScheduleEventType =
  | "created"
  | "confirmation_sent"
  | "nudge_sent"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "completed"
  | "no_show";

export interface ScheduleEvent {
  id: string;
  schedule_id: string;
  event_type: ScheduleEventType;
  detail: string | null;
  created_at: string;
}

export type ReactivationTargetStatus =
  | "pending"
  | "awaiting_response"
  | "responded"
  | "ignored"
  | "converted"
  | "declined"
  | "excluded"
  | "failed";

export interface ReactivationCampaign {
  id: string;
  name: string;
  segment_type: string;
  inactive_days: number;
  message_style: string;
  active: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  allowed_weekdays: number[];
  allowed_hour_start: string;
  allowed_hour_end: string;
  max_messages: number;
  nudge_interval_days: number;
  daily_send_cap: number;
  created_at: string;
  updated_at: string;
}

export interface ReactivationTarget {
  id: string;
  campaign_id: string;
  user_id: string;
  status: ReactivationTargetStatus;
  last_procedure: string | null;
  days_inactive_at_enrollment: number | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 'initial' (mensagem inicial) ou 'nudge_N' - mesmo padrao de tier livre do motor de confirmacao. */
export interface ReactivationMessage {
  id: string;
  target_id: string;
  tier: ReminderTier;
  scheduled_for: string;
  status: ReminderStatus;
  body: string | null;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReactivationEventType =
  | "target_created"
  | "message_sent"
  | "reminder_sent"
  | "responded"
  | "declined"
  | "ignored"
  | "converted"
  | "excluded"
  | "failed";

export interface ReactivationEvent {
  id: string;
  target_id: string;
  event_type: ReactivationEventType;
  detail: string | null;
  created_at: string;
}

export type PostAttendanceFlowMessageType = "simple" | "question" | "review" | "reminder";
export type PostAttendanceDelayUnit = "hours" | "days";

export interface PostAttendanceFlow {
  id: string;
  name: string;
  procedure_match: string; // texto livre comparado a Schedule.procedure, ou 'all'
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostAttendanceFlowMessage {
  id: string;
  flow_id: string;
  sequence: number;
  delay_value: number;
  delay_unit: PostAttendanceDelayUnit;
  message_type: PostAttendanceFlowMessageType;
  body: string; // instrucao de estilo p/ a Claude compor - nunca o texto final
  created_at: string;
  updated_at: string;
}

export type PostAttendanceEnrollmentStatus = "active" | "completed" | "interrupted" | "transferred";
export type PostAttendanceTriggerSource = "manual" | "time_elapsed";

export interface PostAttendanceEnrollment {
  id: string;
  schedule_id: string;
  flow_id: string;
  user_id: string;
  status: PostAttendanceEnrollmentStatus;
  trigger_source: PostAttendanceTriggerSource;
  started_at: string;
  created_at: string;
  updated_at: string;
}

export interface PostAttendanceMessage {
  id: string;
  enrollment_id: string;
  flow_message_id: string;
  scheduled_for: string;
  status: ReminderStatus;
  body: string | null;
  attempts: number;
  postpone_count: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PostAttendanceEventType =
  | "enrolled"
  | "message_sent"
  | "responded"
  | "review_requested"
  | "alert_raised"
  | "alert_raised_failsafe"
  | "transferred"
  | "interrupted"
  | "completed"
  | "skipped_no_link"
  | "skipped_future_appointment"
  | "skipped_conversation_busy"
  | "skipped_schedule_status_changed";

export interface PostAttendanceEvent {
  id: string;
  enrollment_id: string;
  event_type: PostAttendanceEventType;
  detail: string | null;
  created_at: string;
}

export type CommercialOpportunityStage =
  | "new_interest"
  | "evaluation_scheduled"
  | "evaluation_done"
  | "awaiting_decision"
  | "follow_up_active"
  | "procedure_scheduled"
  | "converted"
  | "lost";

export type CommercialSignalType =
  | "price_question"
  | "general_interest"
  | "abandoned_scheduling"
  | "post_evaluation_no_procedure"
  | "will_think"
  | "no_money"
  | "traveling"
  | "needs_to_talk"
  | "come_back_later"
  | "other";

export interface CommercialOpportunity {
  id: string;
  user_id: string;
  procedure_interest: string;
  stage: CommercialOpportunityStage;
  source_signal: CommercialSignalType;
  signal_note: string | null;
  schedule_id: string | null;
  paused: boolean;
  first_contact_at: string;
  evaluation_at: string | null;
  last_message_sent_at: string | null;
  last_message_body: string | null;
  last_response_at: string | null;
  last_response_body: string | null;
  next_action_at: string | null;
  attempts_used: number;
  estimated_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface CommercialFollowUpMessage {
  id: string;
  opportunity_id: string;
  scheduled_for: string;
  status: ReminderStatus;
  body: string | null;
  attempts: number;
  postpone_count: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CommercialEventType =
  | "created"
  | "signal_detected"
  | "stage_changed"
  | "message_sent"
  | "responded"
  | "moved_manually"
  | "schedule_cancelled_or_noshow"
  | "converted"
  | "lost"
  | "escalated_human";

export interface CommercialEvent {
  id: string;
  opportunity_id: string;
  event_type: CommercialEventType;
  detail: string | null;
  created_at: string;
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
  | "CLINIC_CANCELLED_OFFER"
  | "REMINDER_RESPONSE"
  | "REACTIVATION_RESPONSE"
  | "POST_ATTENDANCE_RESPONSE"
  | "COMMERCIAL_FOLLOWUP_RESPONSE";

export interface FlowStateData {
  name?: string;
  procedure?: string;
  durationMinutes?: number;
  /** Data (YYYY-MM-DD) ja mencionada pelo cliente antes de nome/procedimento serem conhecidos - consumida assim que ambos forem coletados, nunca perdida. */
  pendingDate?: string;
  date?: string;
  time?: string;
  availableSlots?: string[];
  selectedStart?: string;
  scheduleId?: string;
  candidates?: { scheduleId: string; procedure: string; date: string; time: string }[];
  reactivationTargetId?: string;
  postAttendanceEnrollmentId?: string;
  commercialOpportunityId?: string;
  commercialProcedureInterest?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  status: ConversationStatus;
  state: ConversationFlowState;
  state_data: FlowStateData;
  priority: boolean;
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
  automated: boolean;
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
  confirmation_enabled: boolean;
  confirmation_hours_before: number;
  confirmation_nudges_enabled: boolean;
  confirmation_nudge_count: number;
  confirmation_nudge_interval_hours: number;
  reactivation_enabled: boolean;
  inactivity_nudge_enabled: boolean;
  post_attendance_enabled: boolean;
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
  google_review_link: string | null;
  commercial_ai_enabled: boolean;
  commercial_max_attempts: number;
  commercial_nudge_interval_days: number;
  commercial_decision_grace_days: number;
  updated_at: string;
}

export interface BusinessHourRow {
  weekday: number;
  enabled: boolean;
}

export interface BusinessHourSlot {
  id: string;
  weekday: number;
  time: string; // "HH:MM:SS" (coluna `time` do Postgres)
  created_at: string;
}

export type BusinessHourExceptionType = "holiday" | "block" | "special";

export interface BusinessHourException {
  id: string;
  date: string;
  type: BusinessHourExceptionType;
  closed: boolean;
  /** Horarios customizados pra esse dia especifico (ex: feriado com expediente reduzido) - null/vazio = sem personalizacao, usa os slots normais da semana quando nao estiver fechado. */
  slots: string[] | null;
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

