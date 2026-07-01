# Workflow: Agendamento de Consultas

## Objetivo
Marcar, remarcar ou cancelar avaliações/consultas para pacientes via WhatsApp. O Google Calendar é a agenda visual da clínica; o Supabase (tabela `schedules`) é o registro estruturado, vinculado ao paciente (`users`) e ao evento do Google Calendar (`google_event_id`).

## Quando usar
O paciente demonstrou interesse em agendar uma avaliação ou procedimento (ex: "quero marcar", "tem horário essa semana?", "queria remarcar", "preciso cancelar minha consulta").

## Configuração da agenda
- Calendário: definido em `GOOGLE_CALENDAR_ID` no `.env` (padrão: calendário principal da conta autenticada).
- Horário de atendimento: Segunda a Sexta, 08:00 às 18:00 (não oferecer horários fora disso, nem sábados/domingos/feriados).
- Duração padrão de slot: 30 minutos para avaliação; procedimentos podem exigir mais tempo — se o paciente já souber o procedimento, usar 60 minutos como padrão para Botox/Preenchimento/Harmonização.

## Inputs necessários antes de agendar
1. Nome completo do paciente
2. Telefone (já disponível — vem do próprio WhatsApp/usuário identificado no Supabase)
3. Procedimento de interesse (ou "avaliação" se ainda não souber)
4. Preferência de data/horário

Se faltar alguma informação, pergunte antes de chamar a ferramenta de agendamento — nunca invente dados do paciente. **Regra obrigatória: uma pergunta por vez.** Nunca combine duas perguntas na mesma mensagem (ex: nunca pergunte nome e data juntos) — envie uma, aguarde a resposta do cliente, e só então faça a próxima.

## Passo a passo

### 1. Marcar nova consulta
Siga esta sequência exata, uma etapa (e uma pergunta) por vez:

1. Pergunte **apenas** o procedimento de interesse (ex: "Para começarmos, poderia me informar seu nome completo?" se ainda não tiver o nome, ou o procedimento — na ordem que fizer sentido na conversa, mas sempre um item por vez). Se ainda não tiver o nome completo do paciente, peça primeiro.
2. Aguarde a resposta. Em seguida, pergunte **apenas** a data desejada.
3. Aguarde a resposta. Chame a ferramenta `check_availability(date)` para aquele dia (ou os próximos dias úteis se o paciente não tiver preferência exata).
4. Apresente 2-4 horários reais retornados pela ferramenta (nunca invente horários) e pergunte qual ele prefere.
5. Aguarde a resposta. Repita de volta data, horário, nome e procedimento, e peça confirmação explícita (ex: "Posso confirmar sua avaliação para 02/07 às 14h?").
6. **Só depois que o cliente confirmar explicitamente** (ex: "sim", "pode ser", "confirmo") você segue para a criação. Nunca chame `create_appointment` sem essa confirmação explícita.
7. Chame `create_appointment(name, service, start, duration_minutes)`. Essa ferramenta cria o evento no Google Calendar primeiro e só então salva o registro em `schedules` no Supabase — nessa ordem, de forma atômica no backend.
8. **Se a ferramenta retornar erro**: nunca diga ao paciente que o agendamento foi realizado. Informe que houve um problema técnico, peça para tentar novamente em instantes ou ofereça encaminhar para um atendente (`request_human_handoff`).
9. **Se a ferramenta tiver sucesso**: confirme o agendamento por mensagem, repetindo data, horário, procedimento e endereço da clínica. Em seguida pergunte "Posso ajudar com mais alguma coisa?" (ver regras de encerramento em [atendimento_faq.md](atendimento_faq.md)).

### 2. Remarcar consulta existente
1. Chame `list_appointments()` para ver os agendamentos ativos do paciente atual.
2. Se houver mais de um agendamento futuro, pergunte **apenas** qual deles o paciente quer remarcar (uma pergunta).
3. Aguarde a resposta, depois pergunte **apenas** a nova data desejada.
4. Aguarde a resposta, chame `check_availability` para aquele dia e apresente os horários reais disponíveis.
5. Aguarde a escolha do horário, repita os dados e peça confirmação explícita antes de prosseguir.
6. Só após confirmação explícita, chame `reschedule_appointment(schedule_id, start, duration_minutes)`.
7. Se der erro, siga a mesma regra do passo 8 acima (nunca afirmar sucesso). Se der certo, confirme por mensagem e pergunte se pode ajudar em mais alguma coisa.

### 3. Cancelar consulta
1. Chame `list_appointments()` para localizar o agendamento.
2. Confirme com o paciente que deseja realmente cancelar antes de executar (pergunta única, aguardar confirmação explícita).
3. Só após confirmação explícita, chame `cancel_appointment(schedule_id)`.
4. Se der erro, nunca afirme que foi cancelado — informe o problema. Se der certo, confirme o cancelamento e, com gentileza, deixe a porta aberta para reagendar quando quiser, perguntando se pode ajudar em mais alguma coisa.

### 4. Confirmar presença (resposta a lembrete)
Quando o paciente responder confirmando presença após um lembrete (ver [lembretes_confirmacoes.md](lembretes_confirmacoes.md)):
1. Chame `list_appointments()` para identificar o agendamento correspondente.
2. Chame `confirm_appointment(schedule_id)`.
3. Agradeça a confirmação.

## Casos excepcionais
- **Nenhum horário disponível na preferência do paciente**: ofereça o próximo horário disponível mais próximo, sem pressionar.
- **Paciente pede horário fora do funcionamento (noite, fim de semana)**: informe educadamente o horário de funcionamento (Seg-Sex, 08h-18h) e ofereça alternativas dentro dele.
- **Paciente novo x paciente recorrente**: o registro em `users` é criado automaticamente na primeira mensagem (nome vindo do WhatsApp); não é necessário diferenciar no agendamento.
- **Erro ao acessar o Google Calendar ou o Supabase**: não invente disponibilidade nem confirme agendamento sem sucesso da ferramenta. Informe ao paciente que a equipe confirmará o horário em breve e considere chamar `request_human_handoff`.
- **Procedimento não listado no FAQ**: aceite o agendamento normalmente como "avaliação" e deixe a definição do procedimento para a consulta presencial.

## Ferramentas usadas
- `check_availability`, `create_appointment`, `list_appointments`, `reschedule_appointment`, `cancel_appointment`, `confirm_appointment` — implementadas em `src/services/schedulingService.ts`, que coordena o Google Calendar (`src/integrations/googleCalendarClient.ts`) e o Supabase (`src/repositories/scheduleRepository.ts`).

## Encaminhamento
- Dúvidas sobre tratamentos, valores ou a clínica antes de agendar → ver [atendimento_faq.md](atendimento_faq.md).
- Após agendar, o lembrete automático é responsabilidade do workflow [lembretes_confirmacoes.md](lembretes_confirmacoes.md) — não é necessário agendar lembrete manualmente aqui.
