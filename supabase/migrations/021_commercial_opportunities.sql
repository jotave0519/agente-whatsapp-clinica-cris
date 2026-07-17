-- IA Comercial: detecta automaticamente pacientes que demonstraram interesse
-- num procedimento mas nao converteram, organiza em oportunidades (Kanban no
-- CRM) e faz acompanhamento contextual via WhatsApp. Mesmo padrao de 3
-- camadas (config / execucao / eventos) dos 3 motores anteriores desta sessao
-- (confirmacao, reativacao, pos-atendimento). Tudo aditivo.

alter table clinic_settings add column if not exists commercial_ai_enabled boolean not null default false;
alter table clinic_settings add column if not exists commercial_max_attempts integer not null default 3;
alter table clinic_settings add column if not exists commercial_nudge_interval_days integer not null default 3;
alter table clinic_settings add column if not exists commercial_decision_grace_days integer not null default 3;

create table if not exists commercial_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  procedure_interest text not null,
  stage text not null default 'new_interest' check (stage in
    ('new_interest', 'evaluation_scheduled', 'evaluation_done', 'awaiting_decision', 'follow_up_active',
     'procedure_scheduled', 'converted', 'lost')),
  source_signal text not null check (source_signal in
    ('price_question', 'general_interest', 'abandoned_scheduling', 'post_evaluation_no_procedure', 'will_think',
     'no_money', 'traveling', 'needs_to_talk', 'come_back_later', 'other')),
  signal_note text, -- citacao real do paciente, capturada no momento da deteccao - usada na composicao contextual (nunca mensagem generica)
  schedule_id uuid references schedules(id) on delete set null,
  paused boolean not null default false, -- true assim que o paciente responde; volta a false quando um novo ciclo de follow-up e agendado
  first_contact_at timestamptz not null default now(),
  evaluation_at timestamptz,
  last_message_sent_at timestamptz,
  last_message_body text,
  last_response_at timestamptz,
  last_response_body text,
  next_action_at timestamptz,
  attempts_used integer not null default 0,
  estimated_value numeric, -- snapshot de procedures.price no momento de virar 'converted'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_commercial_opportunities_one_active_per_user
  on commercial_opportunities (user_id)
  where stage not in ('converted', 'lost');

create index if not exists idx_commercial_opportunities_stage on commercial_opportunities(stage);

create table if not exists commercial_follow_up_messages (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references commercial_opportunities(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  body text,
  attempts integer not null default 0,
  postpone_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_follow_up_messages_due
  on commercial_follow_up_messages (scheduled_for)
  where status = 'pending';

create table if not exists commercial_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references commercial_opportunities(id) on delete cascade,
  event_type text not null check (event_type in
    ('created', 'signal_detected', 'stage_changed', 'message_sent', 'responded', 'moved_manually',
     'schedule_cancelled_or_noshow', 'converted', 'lost', 'escalated_human')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_commercial_events_opportunity on commercial_events(opportunity_id, created_at);

insert into message_templates (key, label, body) values
  ('commercial_stop_ack', 'Oportunidades - paciente pediu para nao receber mais mensagens',
   E'Sem problemas! 😊\n\nQualquer coisa, é só chamar por aqui. 💛')
on conflict (key) do nothing;
