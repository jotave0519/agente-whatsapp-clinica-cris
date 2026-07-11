-- Base de conhecimento administravel da IA (CRM > Configuracoes > Inteligencia da IA).
-- Tudo aditivo: nenhuma coluna/tabela existente e alterada em formato, so estendida.

-- 1) Dados adicionais da clinica (mesma linha unica id=1 de clinic_settings).
alter table clinic_settings add column if not exists responsible_name text;
alter table clinic_settings add column if not exists specialty text;
alter table clinic_settings add column if not exists city text;
alter table clinic_settings add column if not exists state text;
alter table clinic_settings add column if not exists zip_code text;
alter table clinic_settings add column if not exists whatsapp text;
alter table clinic_settings add column if not exists instagram text;
alter table clinic_settings add column if not exists website text;
alter table clinic_settings add column if not exists general_notes text;
alter table clinic_settings add column if not exists about_text text;

-- Tempo maximo (minutos) que a IA mantem o estado de um fluxo de agendamento
-- incompleto antes de considera-lo expirado e reiniciar do zero no proximo
-- contato do cliente. Default 24h (1440min) - hoje esse tempo e fixo em ~10min
-- no codigo (config/conversationPolicy.ts), este campo passa a ser a fonte de
-- verdade, editavel pelo CRM em Configuracoes > Inteligencia da IA > Regras da IA.
alter table clinic_settings add column if not exists context_expiry_minutes integer not null default 1440;

-- 2) FAQ inteligente: perguntas/respostas consultadas pela IA antes de responder.
create table if not exists faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_faq_items_active on faq_items(active);

-- Perguntas de exemplo pre-cadastradas (sem resposta ainda - a IA so usa FAQs
-- com resposta preenchida, entao estas ficam disponiveis para a clinica editar
-- no CRM sem afetar o atendimento ate serem respondidas).
insert into faq_items (question, sort_order) values
  ('Onde fica a clinica?', 1),
  ('Qual o horario de funcionamento?', 2),
  ('Voces trabalham com Botox?', 3),
  ('O Botox doi?', 4),
  ('Quanto tempo dura o Botox?', 5),
  ('Quanto tempo dura o preenchimento labial?', 6),
  ('Quanto tempo dura uma consulta?', 7),
  ('Quais formas de pagamento voces aceitam?', 8),
  ('Voces parcelam?', 9),
  ('Tem estacionamento?', 10),
  ('Posso levar acompanhante?', 11),
  ('Quanto tempo demora o atendimento?', 12),
  ('Como funciona o agendamento?', 13),
  ('Como remarcar?', 14),
  ('Como cancelar?', 15),
  ('Preciso fazer avaliacao antes?', 16),
  ('Quais procedimentos voces realizam?', 17),
  ('Voces fazem harmonizacao facial?', 18),
  ('Voces trabalham com bioestimuladores?', 19),
  ('Voces trabalham com acido hialuronico?', 20),
  ('Qual o WhatsApp da clinica?', 21),
  ('Como chegar?', 22),
  ('Como funciona o pos-procedimento?', 23),
  ('Quais cuidados devo ter depois do Botox?', 24),
  ('Posso tomar sol depois?', 25),
  ('Quanto tempo dura o efeito?', 26),
  ('Voces atendem homens?', 27),
  ('Voces atendem adolescentes?', 28)
on conflict do nothing;

-- 3) Mensagens automaticas editaveis. Seedadas com o texto hoje hardcoded no
-- codigo, para nao mudar nenhum comportamento ate a clinica editar algo.
create table if not exists message_templates (
  key text primary key,
  label text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

insert into message_templates (key, label, body) values
  ('confirm_scheduling_success', 'Confirmacao de agendamento',
   E'Agendamento confirmado! 😊\n\n{{procedure}} em {{date}} às {{time}}.\nEndereço: {{address}}\n\nPosso ajudar com mais alguma coisa?'),
  ('confirm_scheduling_failure', 'Falha ao confirmar agendamento',
   'Desculpe, tive um problema tecnico ao confirmar o agendamento ({{error}}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.'),
  ('confirm_rescheduling_success', 'Confirmacao de remarcacao',
   E'Remarcação confirmada! 😊\n\nSeu novo horário é {{date}} às {{time}}.\n\nPosso ajudar com mais alguma coisa?'),
  ('confirm_rescheduling_failure', 'Falha ao remarcar',
   'Desculpe, tive um problema tecnico ao remarcar ({{error}}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.'),
  ('confirm_cancellation_success', 'Confirmacao de cancelamento',
   E'Cancelamento confirmado. 💛 Se quiser reagendar quando for melhor pra você, é só me chamar.\n\nPosso ajudar com mais alguma coisa?'),
  ('confirm_cancellation_failure', 'Falha ao cancelar',
   'Desculpe, tive um problema tecnico ao cancelar ({{error}}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.'),
  ('abandon_flow', 'Fluxo abandonado a pedido do cliente',
   'Sem problemas, deixei esse atendimento de lado. Posso ajudar com mais alguma coisa?'),
  ('nudge_inactivity', 'Lembrete de inatividade',
   E'😊 Oi! Estou por aqui.\n\nSe ainda desejar continuar seu atendimento, é só responder esta mensagem.'),
  ('close_inactivity', 'Encerramento por inatividade',
   E'Como não recebi nenhuma resposta, vou encerrar este atendimento por enquanto.\n\nQuando quiser continuar, basta enviar uma nova mensagem. Será um prazer ajudar! 💛'),
  ('appointment_reminder', 'Lembrete de consulta (D-1)',
   E'Oi, {{patientName}}! Passando para lembrar da sua consulta de {{procedure}} amanha, dia {{date}} as {{time}}, aqui na clinica ({{address}}).\n\nPode confirmar sua presenca respondendo *SIM*? Se precisar remarcar, e so avisar por aqui.'),
  ('generic_error', 'Erro generico (falha inesperada no atendimento)',
   'Desculpe, tive um problema para responder agora. Nossa equipe vai te retornar em breve.'),
  ('welcome_message', 'Boas-vindas (orientacao de tom - primeira mensagem)',
   'Cumprimente o cliente pelo nome (se souber) de forma calorosa e acolhedora, e apresente as opcoes principais: agendar avaliacao, remarcar, cancelar, conhecer tratamentos ou falar com atendente.'),
  ('no_slot_found', 'Sem horario disponivel (orientacao de tom)',
   'Informe educadamente que nao ha horarios livres na data pedida e peca outra data ao cliente.')
on conflict (key) do nothing;

-- 4) Intervalo de almoco por dia da semana (nulo = sem intervalo configurado).
alter table business_hours add column if not exists lunch_start time;
alter table business_hours add column if not exists lunch_end time;

-- 5) Feriados, bloqueios e dias com horario especial.
create table if not exists business_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  type text not null check (type in ('holiday', 'block', 'special')),
  closed boolean not null default true,
  open_time time,
  close_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6) Orientacoes de procedimento usadas pela IA (sem valores - preco continua
-- em `price`, usado pelo Financeiro, mas nao entra no contexto da IA).
alter table procedures add column if not exists notes text;
alter table procedures add column if not exists pre_instructions text;
alter table procedures add column if not exists post_instructions text;
