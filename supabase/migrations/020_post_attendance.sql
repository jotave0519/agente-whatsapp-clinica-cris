-- IA de pos-atendimento: fluxos configuraveis que acompanham o paciente via
-- WhatsApp apos uma consulta concluida (marcacao manual OU horario passado).
-- Mesmo padrao de 3 camadas (config / execucao-fila / eventos) da reativacao
-- (019_patient_reactivation.sql). Tudo aditivo.

alter table clinic_settings add column if not exists google_review_link text;

alter table conversations add column if not exists priority boolean not null default false;
create index if not exists idx_conversations_priority on conversations(priority) where priority = true;

-- Duracao efetivamente usada na criacao do agendamento (ja resolvida hoje via
-- findProcedureDuration ou informada manualmente no CRM, mas ate agora era
-- descartada apos servir so para checar disponibilidade no Google Calendar).
-- Persistir aqui permite calcular quando ESSA consulta especifica terminou,
-- sem depender da duracao ATUAL configurada para o procedimento. Nullable:
-- agendamentos antigos caem no fallback via findProcedureDuration.
alter table schedules add column if not exists duration_minutes integer;

create table if not exists post_attendance_flows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  procedure_match text not null, -- comparado a schedules.procedure (mesmo algoritmo de findProcedureDuration) ou 'all'
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists post_attendance_flow_messages (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references post_attendance_flows(id) on delete cascade,
  sequence integer not null,
  delay_value integer not null,
  delay_unit text not null check (delay_unit in ('hours', 'days')),
  message_type text not null check (message_type in ('simple', 'question', 'review', 'reminder')),
  body text not null, -- instrucao de estilo p/ a Claude compor; nunca o texto final (link do 'review' e literal, anexado depois)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, sequence)
);

create table if not exists post_attendance_enrollments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  flow_id uuid not null references post_attendance_flows(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'interrupted', 'transferred')),
  trigger_source text not null check (trigger_source in ('manual', 'time_elapsed')),
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id)
);

create table if not exists post_attendance_messages (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references post_attendance_enrollments(id) on delete cascade,
  flow_message_id uuid not null references post_attendance_flow_messages(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  body text,
  attempts integer not null default 0,
  postpone_count integer not null default 0, -- contador separado de attempts: "conversa ocupada" nunca conta como falha
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, flow_message_id)
);

create index if not exists idx_post_attendance_messages_due
  on post_attendance_messages (scheduled_for)
  where status = 'pending';

create table if not exists post_attendance_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references post_attendance_enrollments(id) on delete cascade,
  event_type text not null check (event_type in
    ('enrolled', 'message_sent', 'responded', 'review_requested', 'alert_raised', 'alert_raised_failsafe',
     'transferred', 'interrupted', 'completed', 'skipped_no_link', 'skipped_future_appointment',
     'skipped_conversation_busy', 'skipped_schedule_status_changed')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_post_attendance_events_enrollment on post_attendance_events(enrollment_id, created_at);

insert into message_templates (key, label, body) values
  ('post_attendance_stop_ack', 'Pos-atendimento - paciente pediu para nao receber mais mensagens',
   E'Sem problemas! 😊\n\nVou parar por aqui. Se precisar de qualquer coisa, é só chamar. 💛')
on conflict (key) do nothing;
