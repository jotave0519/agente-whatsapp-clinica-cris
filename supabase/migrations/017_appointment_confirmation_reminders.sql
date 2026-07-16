-- Motor de lembretes escalonados (48h/24h/3h) + status de confirmacao por
-- agendamento. Aditivo: schedules.reminder_sent/confirmed e
-- clinic_settings.reminders_enabled ficam orfaos (nao removidos) - sem acesso
-- a SQL bruto interativo neste ambiente, e mais seguro nunca dropar coluna do
-- que arriscar quebrar algo que nao da pra inspecionar antes.

-- 1) Status de confirmacao por agendamento (amarelo=pending / verde=confirmed / vermelho=cancelled)
alter table schedules add column if not exists confirmation_status text
  not null default 'pending' check (confirmation_status in ('pending', 'confirmed', 'cancelled'));

-- 2) Motor de lembretes escalonados
create table if not exists appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  tier text not null check (tier in ('48h', '24h', '3h')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, tier)
);

create index if not exists idx_appointment_reminders_due
  on appointment_reminders (scheduled_for)
  where status = 'pending';

-- 3) Diferenciacao de mensagem automatica vs conversa normal (CRM > Conversas)
alter table messages add column if not exists automated boolean not null default false;

-- 4) Toggles por camada, mesmo padrao de reminders_enabled/inactivity_nudge_enabled
--    (CRM > WhatsApp > Automacoes) - substituem reminders_enabled, que fica orfa.
alter table clinic_settings add column if not exists reminder_48h_enabled boolean not null default true;
alter table clinic_settings add column if not exists reminder_24h_enabled boolean not null default true;
alter table clinic_settings add column if not exists reminder_3h_enabled boolean not null default true;

-- 5) Templates novos (variaveis em portugues, pedido explicito do usuario)
insert into message_templates (key, label, body) values
  ('reminder_48h', 'Lembrete de consulta (48h antes)',
   E'Oi, {{nome}}! 😊\n\nPassando para confirmar sua consulta de {{procedimento}} {{dia_semana}}, dia {{data}} às {{hora}}.\n\nEstá tudo certo para você?'),
  ('reminder_24h', 'Lembrete de consulta (24h antes)',
   E'Olá! 😊\n\nEstamos passando para lembrar que sua consulta de {{procedimento}} será amanhã, {{dia_semana}}, dia {{data}} às {{hora}}.\n\nEstá tudo certo para você?'),
  ('reminder_3h', 'Lembrete de consulta (3h antes)',
   E'Olá!\n\nPassando para lembrar que sua consulta de {{procedimento}} será hoje às {{hora}}.\n\nEsperamos você!'),
  ('reminder_confirm_ack', 'Confirmacao recebida (resposta ao lembrete)',
   E'Perfeito! 😊\n\nSua presença foi confirmada.')
on conflict (key) do nothing;
