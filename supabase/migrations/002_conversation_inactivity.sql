-- Suporte a controle de inatividade da conversa (nudge aos 5min, encerramento aos 10min).

alter table conversations drop constraint if exists conversations_status_check;
alter table conversations add constraint conversations_status_check check (status in ('ai', 'human', 'closed'));

alter table conversations add column if not exists last_user_message_at timestamptz;
alter table conversations add column if not exists nudge_sent_at timestamptz;

create index if not exists idx_conversations_status on conversations(status);
