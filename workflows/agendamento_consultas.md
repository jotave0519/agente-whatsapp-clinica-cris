# Workflow: Agendamento de Consultas

## Objetivo
Marcar, remarcar ou cancelar avaliações/consultas para pacientes via WhatsApp. O Google Calendar é a agenda visual da clínica; o Supabase (tabela `schedules`) é o registro estruturado, vinculado ao paciente (`users`) e ao evento do Google Calendar (`google_event_id`).

## Como isso é implementado
Esse fluxo roda sobre uma **máquina de estados** (`src/services/conversationFlowService.ts` + `src/services/aiAgentService.ts`), não sobre instruções livres. Cada conversa tem um `state` salvo no Supabase (`conversations.state`), e enquanto esse estado não for `MENU`, você (o modelo) só recebe as ferramentas daquela etapa específica — é fisicamente impossível voltar ao menu, pular etapas ou confirmar uma ação sem que a ferramenta correspondente tenha sido chamada com sucesso. Isso existe porque depender só de "lembrar o contexto" causava o agente perder o fio da meada e voltar ao menu no meio de um agendamento.

Você não precisa gerenciar o estado manualmente — só chamar a ferramenta certa a cada mensagem, conforme instruído no prompt daquela etapa. As regras abaixo descrevem o comportamento esperado; o código já impede a maioria dos desvios.

## Configuração da agenda
- Calendário: definido em `GOOGLE_CALENDAR_ID` no `.env`.
- Horário de atendimento: Segunda a Sexta, 08:00 às 18:00 (não oferecer horários fora disso, nem sábados/domingos/feriados) — já é respeitado automaticamente pela ferramenta de disponibilidade.
- Duração padrão de slot: 30 minutos.

## Regra obrigatória: uma pergunta por vez
Nunca combine duas perguntas na mesma mensagem (ex: nunca pergunte nome e data juntos). Cada etapa da máquina de estados já força isso — só peça a informação da etapa atual.

## Fluxo: nova consulta (`begin_scheduling` → `MENU`)
1. Cliente demonstra interesse em agendar → chame `begin_scheduling(procedure)`, incluindo `name`/`date` se o cliente já os tiver informado na mesma mensagem.
2. **Etapa SCHEDULING_NAME**: se faltar o nome, pergunte (só isso) e chame `provide_name(name)` quando o cliente responder.
3. **Etapa SCHEDULING_DATE**: pergunte a data desejada (só isso). Ao receber, chame `provide_date(date)` — isso consulta o Google Calendar de verdade e retorna os horários livres.
4. **Etapa SCHEDULING_TIME**: apresente 2-4 horários reais retornados (nunca invente) e pergunte qual o cliente prefere. Ao escolher, chame `select_time(start)`.
5. **Etapa SCHEDULING_CONFIRM**: repita nome, procedimento, data e horário, e peça confirmação explícita (ex: "Posso confirmar sua avaliação para 02/07 às 14h?"). **Só depois de confirmação explícita do cliente** chame `confirm_scheduling()` — essa ferramenta cria o evento no Google Calendar e o registro em `schedules` no Supabase, nessa ordem, e só reporta sucesso se ambos derem certo.
6. Se `confirm_scheduling` retornar erro, nunca diga que o agendamento foi feito — informe o problema e ofereça tentar de novo ou falar com um atendente.
7. Se dado certo, confirme por mensagem (nome do procedimento, data, horário, endereço) e pergunte "Posso ajudar com mais alguma coisa?".

## Fluxo: remarcação (`begin_rescheduling`)
1. Cliente pede para remarcar → chame `begin_rescheduling()`. A ferramenta já busca os agendamentos ativos do cliente no Supabase.
   - Se não houver nenhum, você será informado — avise o cliente e volte ao atendimento geral.
   - Se houver só um, ele já é selecionado automaticamente e você vai direto para a etapa de nova data.
   - Se houver mais de um, você entra na **etapa RESCHEDULING_SELECT**: liste-os e pergunte qual remarcar; ao responder, chame `select_appointment_to_reschedule(schedule_id)`.
2. **Etapa RESCHEDULING_DATE**: pergunte a nova data (só isso). Ao receber, chame `provide_reschedule_date(date)` (consulta real ao Google Calendar).
3. **Etapa RESCHEDULING_TIME**: apresente os horários reais e pergunte qual prefere. Ao escolher, chame `select_reschedule_time(start)`.
4. **Etapa RESCHEDULING_CONFIRM**: peça confirmação explícita. Só depois chame `confirm_rescheduling()` — atualiza o evento no Google Calendar e o registro no Supabase, nessa ordem.
5. Erro → nunca afirme sucesso, informe o problema. Sucesso → confirme por mensagem e pergunte se pode ajudar em mais alguma coisa.

## Fluxo: cancelamento (`begin_cancellation`)
1. Cliente pede para cancelar → chame `begin_cancellation()`. Mesma lógica de busca automática de `begin_rescheduling` (0 → avisa; 1 → segue direto; 2+ → **etapa CANCELING_SELECT**, chame `select_appointment_to_cancel(schedule_id)` após a escolha).
2. **Etapa CANCELING_CONFIRM**: confirme com o cliente que ele realmente quer cancelar aquele agendamento específico. Só depois de confirmação explícita chame `confirm_cancellation()`.
3. Erro → nunca afirme cancelamento. Sucesso → confirme com gentileza, deixe a porta aberta para reagendar, e pergunte se pode ajudar em mais alguma coisa.

## Confirmações
Enquanto o estado for uma etapa `*_CONFIRM`, respostas como "sim", "pode", "confirmado", "confirma", "ok", "beleza", "certo", "isso mesmo" são tratadas como confirmação. Boa parte disso já é interceptado automaticamente pelo código antes mesmo de chegar até você (fast-path determinístico) — mas se a mensagem for ambígua (ex: "sim mas pode mudar o horário?"), você decide com calma se deve chamar a ferramenta de confirmação ou esclarecer antes.

## Desistência do fluxo
Se o cliente pedir claramente para parar ("deixa pra lá", "esquece isso", "mudei de ideia"), chame `abandon_flow()` para voltar ao atendimento geral. Não faça isso por conta própria sem um pedido claro do cliente — é proibido voltar ao menu no meio do fluxo por iniciativa sua.

## Confirmar presença (resposta a lembrete)
Quando o paciente responder confirmando presença após um lembrete automático (ver [lembretes_confirmacoes.md](lembretes_confirmacoes.md)), e isso não fizer parte de um fluxo de agendamento em andamento (ou seja, o estado é `MENU`): identifique o agendamento e chame `confirm_appointment(schedule_id)`.

## Casos excepcionais
- **Nenhum horário disponível na data pedida**: a ferramenta de data já informa isso; peça outra data ao cliente, sem pressionar.
- **Paciente pede horário fora do funcionamento**: informe o horário de funcionamento (Seg-Sex, 08h-18h) e ofereça alternativas dentro dele.
- **Paciente novo x recorrente**: o registro em `users` é criado automaticamente na primeira mensagem; não precisa diferenciar.
- **Erro em qualquer ferramenta**: nunca invente sucesso. Informe o problema e considere `request_human_handoff` (esse continua disponível fora de qualquer fluxo, no atendimento geral).
- **Procedimento não listado no FAQ**: aceite como "avaliação" e deixe a definição para a consulta presencial.

## Ferramentas usadas
Implementadas em `src/services/conversationFlowService.ts` (lógica determinística de estado) e expostas ao modelo via `src/services/aiAgentService.ts`, que só libera as ferramentas da etapa atual:
`begin_scheduling`, `provide_name`, `provide_date`, `select_time`, `confirm_scheduling`, `begin_rescheduling`, `select_appointment_to_reschedule`, `provide_reschedule_date`, `select_reschedule_time`, `confirm_rescheduling`, `begin_cancellation`, `select_appointment_to_cancel`, `confirm_cancellation`, `abandon_flow`, `confirm_appointment`.

## Encaminhamento
- Dúvidas sobre tratamentos, valores ou a clínica → ver [atendimento_faq.md](atendimento_faq.md) (só se aplica quando o estado é `MENU`).
- Após agendar, o lembrete automático é responsabilidade do workflow [lembretes_confirmacoes.md](lembretes_confirmacoes.md) — não precisa agendar lembrete manualmente aqui.
