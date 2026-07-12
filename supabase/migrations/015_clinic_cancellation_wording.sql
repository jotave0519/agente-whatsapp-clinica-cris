-- Garante os templates de cancelamento pela clinica com o texto correto,
-- independente de a migracao 014 ja ter sido rodada ou nao (checagem ao vivo
-- mostrou que a linha 'clinic_initiated_cancellation' nunca chegou a ser
-- criada em producao - o INSERT abaixo cobre esse caso).
--
-- Texto ajustado: data por extenso (dia da semana) em vez de DD/MM/AAAA,
-- motivo em uma linha so, e pergunta de remarcacao que varia conforme existir
-- motivo ou nao.

insert into message_templates (key, label, body) values
  ('clinic_initiated_cancellation', 'Aviso de cancelamento pela clinica (com oferta de remarcacao)',
   E'Olá, {{patientName}}!\n\nInfelizmente precisaremos cancelar sua consulta que estava marcada para {{date}} às {{time}}.{{reasonBlock}}\n\nPedimos desculpas pelo transtorno.\n\n{{offerQuestion}}'),
  ('clinic_cancellation_decline', 'Resposta quando o cliente nao quer remarcar apos cancelamento pela clinica',
   E'Tudo bem! 😊\n\nQuando desejar agendar novamente, será um prazer atendê-lo.')
on conflict (key) do nothing;

-- Se a migracao 014 tiver sido rodada em outro ambiente com o texto antigo,
-- atualiza para o novo (guardado pelo texto antigo exato, para nao
-- sobrescrever uma personalizacao ja feita pela clinica pelo CRM).
update message_templates
set body = E'Olá, {{patientName}}!\n\nInfelizmente precisaremos cancelar sua consulta que estava marcada para {{date}} às {{time}}.{{reasonBlock}}\n\nPedimos desculpas pelo transtorno.\n\n{{offerQuestion}}',
    updated_at = now()
where key = 'clinic_initiated_cancellation'
  and body = E'Olá, {{patientName}}! 😊\n\nPrecisamos informar que, por um imprevisto, infelizmente será necessário cancelar {{procedure}} que estava agendado(a) para {{date}} às {{time}}.{{reasonBlock}}\n\nPedimos desculpas pelo transtorno. 💛\n\nSe desejar, posso encontrar um novo horário para você agora mesmo. Gostaria que eu encontrasse um novo horário?';
