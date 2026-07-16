-- IA de reativacao de pacientes: campanhas segmentadas + fila de mensagens
-- (motor de 2 tabelas: target = relacionamento paciente-campanha, message =
-- fila de envio propriamente dita, no mesmo espirito de appointment_reminders/
-- reminder_messages ja usado pelo motor de confirmacao de consultas) + log de
-- eventos. Tudo aditivo.

alter table users add column if not exists do_not_contact boolean not null default false;
alter table clinic_settings add column if not exists reactivation_enabled boolean not null default true;

create table if not exists reactivation_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment_type text not null,
  inactive_days integer not null,
  message_style text not null default 'acolhedor e natural, como uma recepcionista que sente falta do paciente',
  active boolean not null default true,
  scheduled_start date,
  scheduled_end date,
  allowed_weekdays integer[] not null default '{1,2,3,4,5}',
  allowed_hour_start time not null default '09:00',
  allowed_hour_end time not null default '18:00',
  max_messages integer not null default 2,
  nudge_interval_days integer not null default 7,
  daily_send_cap integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reactivation_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references reactivation_campaigns(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in
    ('pending', 'awaiting_response', 'responded', 'ignored', 'converted', 'declined', 'excluded', 'failed')),
  last_procedure text,
  days_inactive_at_enrollment integer,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

-- No maximo 1 target ATIVO por paciente entre TODAS as campanhas ao mesmo
-- tempo - evita duas campanhas diferentes mandando mensagem pro mesmo
-- paciente na mesma semana.
create unique index if not exists idx_reactivation_targets_one_active_per_user
  on reactivation_targets (user_id)
  where status in ('pending', 'awaiting_response');

create table if not exists reactivation_messages (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references reactivation_targets(id) on delete cascade,
  tier text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  body text,
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_id, tier)
);

create index if not exists idx_reactivation_messages_due
  on reactivation_messages (scheduled_for)
  where status = 'pending';

create table if not exists reactivation_events (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references reactivation_targets(id) on delete cascade,
  event_type text not null check (event_type in
    ('target_created', 'message_sent', 'reminder_sent', 'responded', 'declined', 'ignored', 'converted', 'excluded', 'failed')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reactivation_events_target on reactivation_events(target_id, created_at);

insert into message_templates (key, label, body) values
  ('reactivation_nudge', 'Reativacao - lembrete de nao-resposta',
   E'Oi! 😊\n\nSó passando para reforçar que estamos à disposição caso precise de qualquer atendimento.'),
  ('reactivation_decline_ack', 'Reativacao - recusa reconhecida',
   E'Sem problemas. 😊\n\nQuando precisar, estaremos sempre à disposição. Tenha um excelente dia! 💛')
on conflict (key) do nothing;
