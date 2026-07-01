-- Maquina de estados por conversa, para o fluxo de agendamento/remarcacao/cancelamento
-- nunca perder o contexto e "voltar ao menu" no meio de uma operacao.

alter table conversations add column if not exists state text not null default 'MENU';
alter table conversations add column if not exists state_data jsonb not null default '{}'::jsonb;

create index if not exists idx_conversations_state on conversations(state);
