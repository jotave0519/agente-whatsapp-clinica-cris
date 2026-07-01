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

Se faltar alguma informação, pergunte antes de chamar a ferramenta de agendamento — nunca invente dados do paciente.

## Passo a passo

### 1. Marcar nova consulta
1. Pergunte o procedimento de interesse e a preferência de data/dia da semana.
2. Chame a ferramenta `check_availability(date)` para listar horários livres no dia (ou nos próximos dias úteis se o paciente não tiver preferência de data).
3. Apresente 2-3 opções de horário ao paciente (não a lista inteira).
4. Confirme com o paciente o horário escolhido, nome completo e procedimento.
5. Chame `create_appointment(name, service, start, duration_minutes)` — isso cria o evento no Google Calendar e o registro em `schedules` no Supabase automaticamente.
6. Confirme o agendamento por mensagem, repetindo data, horário, procedimento e endereço da clínica.

### 2. Remarcar consulta existente
1. Chame `list_appointments()` para ver os agendamentos ativos do paciente atual.
2. Se houver mais de um agendamento futuro, pergunte qual deles o paciente quer remarcar.
3. Verifique disponibilidade (`check_availability`) e confirme o novo horário com o paciente.
4. Chame `reschedule_appointment(schedule_id, start, duration_minutes)`.
5. Confirme a remarcação por mensagem.

### 3. Cancelar consulta
1. Chame `list_appointments()` para localizar o agendamento.
2. Confirme com o paciente que deseja realmente cancelar antes de executar.
3. Chame `cancel_appointment(schedule_id)`.
4. Confirme o cancelamento e, com gentileza, deixe a porta aberta para reagendar quando quiser.

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
