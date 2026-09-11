-- Liga cada lancamento financeiro (transactions) ao atendimento de origem
-- (schedules), quando houver um. Aditivo e nao-destrutivo: coluna nullable,
-- nenhuma linha existente e alterada, nenhuma tabela e removida/recriada.
-- Fonte unica de verdade: o valor/status de pagamento de um atendimento
-- passa a viver so em transactions, referenciado por schedule_id - nunca
-- duplicado em schedules.

alter table transactions add column if not exists schedule_id uuid references schedules(id) on delete set null;

create index if not exists idx_transactions_schedule_id on transactions(schedule_id);
