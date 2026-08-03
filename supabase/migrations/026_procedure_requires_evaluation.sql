-- Procedimentos que exigem avaliacao previa: a IA do WhatsApp substitui o
-- agendamento direto por uma "Avaliacao", preservando o pedido original.
-- Default false preserva o comportamento atual (agenda direto) sem excecao.
alter table procedures add column if not exists requires_evaluation boolean not null default false;

-- Guarda o procedimento originalmente pedido pelo paciente quando o
-- agendamento criado e na verdade uma avaliacao (substituicao automatica).
-- Null em todos os agendamentos normais, incluindo os manuais pelo CRM.
alter table schedules add column if not exists requested_procedure text;
