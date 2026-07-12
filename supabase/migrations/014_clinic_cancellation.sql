-- Mensagens usadas quando a propria clinica cancela um agendamento pelo CRM
-- (aviso automatico ao cliente + oferta de remarcacao pela IA).

insert into message_templates (key, label, body) values
  ('clinic_initiated_cancellation', 'Aviso de cancelamento pela clinica (com oferta de remarcacao)',
   E'Olá, {{patientName}}! 😊\n\nPrecisamos informar que, por um imprevisto, infelizmente será necessário cancelar {{procedure}} que estava agendado(a) para {{date}} às {{time}}.{{reasonBlock}}\n\nPedimos desculpas pelo transtorno. 💛\n\nSe desejar, posso encontrar um novo horário para você agora mesmo. Gostaria que eu encontrasse um novo horário?'),
  ('clinic_cancellation_decline', 'Resposta quando o cliente nao quer remarcar apos cancelamento pela clinica',
   E'Tudo bem! 😊\n\nQuando desejar agendar novamente, será um prazer atendê-lo.')
on conflict (key) do nothing;
