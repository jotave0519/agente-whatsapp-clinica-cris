-- Sistema de notificacoes push da Agenda (doutora/equipe, nunca o paciente).
-- 100% aditivo: 4 tabelas novas, nenhuma tabela existente e alterada.

-- Uma linha por dispositivo/navegador inscrito (uma pessoa pode ter
-- celular + desktop inscritos ao mesmo tempo, por isso nao e 1:1 com staff).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_staff_id on push_subscriptions(staff_id);

-- Preferencias por pessoa da equipe. Sem linha = valores padrao (todas
-- ligadas, lembrete 10 min antes) - nao precisa seed pra quem ja existe.
create table if not exists notification_settings (
  staff_id uuid primary key references staff(id) on delete cascade,
  reminders_enabled boolean not null default true,
  reminder_minutes_before integer not null default 10 check (reminder_minutes_before in (5, 10, 15, 30)),
  new_appointment_enabled boolean not null default true,
  changes_enabled boolean not null default true,
  cancellations_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Historico pra central de notificacoes (sino) - Fase B usa isso pra
-- listar; a Fase A ja grava aqui toda notificacao enviada.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  type text not null check (type in ('reminder', 'created', 'updated', 'cancelled')),
  title text not null,
  body text not null,
  schedule_id uuid references schedules(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_staff_id on notifications(staff_id, created_at desc);

-- Registra que "esse atendimento ja lembrou essa pessoa" - evita lembrete
-- duplicado. O horario do lembrete NUNCA e salvo aqui: e sempre recalculado
-- ao vivo (data/hora do atendimento - preferencia da pessoa), entao um
-- reagendamento muda o resultado automaticamente sem precisar "cancelar"
-- nada aqui - so limpamos essa linha na hora de remarcar, pra permitir
-- lembrar de novo no horario novo.
create table if not exists schedule_reminder_log (
  schedule_id uuid not null references schedules(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (schedule_id, staff_id)
);
