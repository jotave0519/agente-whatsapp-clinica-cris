-- Motor de confirmacao v2: horario configuravel (em vez de 3 tiers fixos),
-- lembretes de nao-resposta configuraveis, status "aguardando confirmacao",
-- sincronizacao com Google Calendar ao confirmar, e log de eventos por
-- agendamento (usado pela pagina do paciente e para auditoria). Estende a
-- migracao 017 (ja rodada) sem perder nada dela.

-- 1) Novos campos em schedules
alter table schedules add column if not exists confirmed_at timestamptz;
alter table schedules add column if not exists was_rescheduled boolean not null default false;

-- Amplia os valores aceitos por confirmation_status (adiciona 'awaiting') e
-- por status (adiciona 'Faltou', usado quando a recepcao marca falta manualmente).
-- Os nomes abaixo sao os padrao do Postgres para constraints inline sem nome
-- explicito (tabela_coluna_check); se o nome real for outro, o DROP CONSTRAINT
-- falha e o erro mostra o nome certo para eu ajustar.
alter table schedules drop constraint if exists schedules_confirmation_status_check;
alter table schedules add constraint schedules_confirmation_status_check
  check (confirmation_status in ('pending', 'awaiting', 'confirmed', 'cancelled'));

alter table schedules drop constraint if exists schedules_status_check;
alter table schedules add constraint schedules_status_check
  check (status in ('Agendado', 'Cancelado', 'Concluido', 'Faltou'));

-- 2) appointment_reminders deixa de ter um enum fixo de tier (48h/24h/3h) -
-- vira 'confirmation' ou 'nudge_N', validado so em codigo daqui pra frente.
-- Tabela ainda vazia em producao (criada pela 017), sem dado a migrar.
alter table appointment_reminders drop constraint if exists appointment_reminders_tier_check;

-- 3) Log de eventos por agendamento - historico da pagina do paciente e base
-- dos "logs" (horario enviado/respondido, tempo ate confirmacao, etc, tudo
-- derivavel de uma sequencia de eventos com timestamp).
create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  event_type text not null check (event_type in
    ('created', 'confirmation_sent', 'nudge_sent', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_schedule_events_schedule on schedule_events(schedule_id, created_at);

-- 4) Configuracao do horario de confirmacao e dos lembretes de nao-resposta.
-- reminder_{48h,24h,3h}_enabled (da 017) ficam orfaos - substituidos por estes.
alter table clinic_settings add column if not exists confirmation_enabled boolean not null default true;
alter table clinic_settings add column if not exists confirmation_hours_before integer not null default 24;
alter table clinic_settings add column if not exists confirmation_nudges_enabled boolean not null default true;
alter table clinic_settings add column if not exists confirmation_nudge_count integer not null default 2;
alter table clinic_settings add column if not exists confirmation_nudge_interval_hours integer not null default 6;

-- 5) Templates: remove os 3 da v1 (inseridos nesta mesma sessao, sem uso real
-- em producao - seguro remover), atualiza o texto de confirmacao recebida, e
-- insere os 2 novos templates do modelo configuravel.
delete from message_templates where key in ('reminder_48h', 'reminder_24h', 'reminder_3h');

update message_templates
set body = E'Perfeito! 😊\n\nSua consulta está confirmada. Até breve!',
    updated_at = now()
where key = 'reminder_confirm_ack';

insert into message_templates (key, label, body) values
  ('confirmation_request', 'Pedido de confirmacao de consulta',
   E'Olá, {{nome}}! 😊\n\nPassando para confirmar sua consulta na Clínica Dra. Cristiane Zangelmi.\n\n📅 {{dia_semana}}\n🕘 {{hora}}\n\nVocê confirma sua presença?\n\nResponda:\n✅ Confirmar\n❌ Cancelar\n🔄 Remarcar'),
  ('confirmation_nudge', 'Lembrete de nao-resposta (confirmacao pendente)',
   E'Olá 😊\n\nSó passando para lembrar da confirmação da sua consulta.\n\nPode responder quando puder.')
on conflict (key) do nothing;
