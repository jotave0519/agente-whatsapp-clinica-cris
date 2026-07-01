# Workflow: Lembretes e Confirmações

## Objetivo
Reduzir faltas (no-show) enviando lembretes automáticos de consultas marcadas e coletando confirmação ou cancelamento do paciente antes do horário.

## Quando roda
Este workflow não é acionado por uma mensagem recebida — ele roda de forma agendada, implementado em `src/services/reminderService.ts` e disparado de duas formas possíveis:
- **Cron in-process** (`src/cron/reminderCron.ts`): roda automaticamente todo dia útil às 08:00 (America/Sao_Paulo) enquanto o servidor (`npm run dev` / `npm start`) estiver ativo.
- **Execução manual/externa** (`npm run reminders`, via `src/jobs/sendReminders.ts`): útil para rodar via Task Scheduler/cron do sistema operacional em vez de depender do processo do servidor ficar de pé.

## Passo a passo

1. `sendDailyReminders()` busca no Supabase (`schedules`) todos os agendamentos com `status = 'Agendado'`, `date` = amanhã e `reminder_sent = false`.
2. Para cada agendamento, envia via Evolution API (`sendWhatsAppMessage`) uma mensagem de lembrete no tom da clínica, contendo:
   - Nome do paciente
   - Procedimento agendado
   - Data e horário
   - Endereço da clínica
   - Pedido simples de confirmação (ex: "Pode confirmar sua presença respondendo *SIM*? Se precisar remarcar, é só avisar por aqui.")
3. Marca `reminder_sent = true` no registro do agendamento (Supabase), para não enviar duplicado.

## Tratando a resposta do paciente (quando a mensagem chega de volta pelo webhook)
- **Confirmou presença** ("sim", "confirmado", "vou sim", etc.): o agente deve chamar `confirm_appointment(schedule_id)` (ver [agendamento_consultas.md](agendamento_consultas.md), seção 4) e agradecer com cordialidade.
- **Pediu para remarcar ou cancelar**: seguir o workflow [agendamento_consultas.md](agendamento_consultas.md) (seções de remarcação/cancelamento).
- **Não respondeu até algumas horas antes do horário**: não é necessário reenviar automaticamente nesta primeira versão — decisão de reforço manual fica com a equipe.
- **Resposta ambígua ou dúvida**: tratar como atendimento normal, seguindo [atendimento_faq.md](atendimento_faq.md).

## Casos excepcionais
- **Consulta marcada para o mesmo dia (sem 1 dia de antecedência)**: não há tempo hábil para lembrete D-1; o filtro por `date = amanhã` já cobre isso automaticamente.
- **Paciente sem telefone válido no registro**: pular o envio (não deveria ocorrer, já que `phone` é obrigatório em `schedules`).
- **Falha no envio via Evolution API**: registrar erro no log, não travar o restante do lote — seguir para o próximo paciente; o registro continua com `reminder_sent = false` e será tentado novamente na próxima execução.

## Ferramentas usadas
- `src/repositories/scheduleRepository.ts` (`findSchedulesNeedingReminder`, `markReminderSent`, `markConfirmed`) — consulta e atualização no Supabase.
- `src/integrations/evolutionApiClient.ts` (`sendWhatsAppMessage`) — envio da mensagem de lembrete via WhatsApp.
- `src/services/reminderService.ts` — orquestra a rotina diária.

## Aprendizados / ajustes
_(preencher conforme o uso real: horário ideal de disparo, taxa de resposta, textos que funcionam melhor, etc.)_
