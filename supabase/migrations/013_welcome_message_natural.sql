-- Atualiza o texto padrao de welcome_message para nao mais orientar a IA a
-- listar "opcoes principais" (que levava a um menu numerado disfarcado).
-- UPDATE guardado pelo texto antigo exato, para nao sobrescrever caso a
-- clinica ja tenha customizado essa mensagem pelo CRM.
update message_templates
set body = 'Cumprimente de forma calorosa e profissional, dando as boas-vindas a clinica e se apresentando brevemente como a assistente virtual. Pergunte como pode ajudar hoje. Nao liste opcoes numeradas nem mencione um menu - deixe a conversa fluir naturalmente a partir da resposta do cliente.',
    updated_at = now()
where key = 'welcome_message'
  and body = 'Cumprimente o cliente pelo nome (se souber) de forma calorosa e acolhedora, e apresente as opcoes principais: agendar avaliacao, remarcar, cancelar, conhecer tratamentos ou falar com atendente.';
