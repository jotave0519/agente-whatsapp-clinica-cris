# Agente de WhatsApp + CRM Web — Dra. Cristiane Zangelmi (Estética Avançada)

Sistema de atendimento inteligente via WhatsApp, construído no framework **WAT** (ver [claude.md](claude.md)), com um CRM web para a equipe da clínica servido pelo mesmo backend:
- `workflows/` — instruções (SOPs) que o agente de IA segue
- `src/` — backend TypeScript, organizado em camadas:
  - `controllers/` — recebem requisições HTTP (webhook do WhatsApp, health check)
  - `controllers/api/`, `routes/api.ts`, `middleware/requireAuth.ts` — API REST do CRM (`/api/v1/*`), protegida por Supabase Auth
  - `services/` — regras de negócio (agente de IA, agendamento, lembretes, usuários) — reaproveitadas tanto pelo WhatsApp quanto pelo CRM
  - `repositories/` — acesso ao Supabase
  - `integrations/` — clients externos (Evolution API, Google Calendar, Anthropic, Supabase)
  - `cron/`, `jobs/` — rotina agendada de lembretes
- `web/` — CRM web (Vite + React + TypeScript), buildado e servido como estático pelo mesmo Express (sem serviço/deploy separado)

## Funcionalidades
1. **Identificação automática do cliente** — cria/recupera o registro em `users` (Supabase) pelo telefone recebido no webhook.
2. **Atendimento inicial com menu + linguagem natural** — apresenta opções (agendar, remarcar, cancelar, tratamentos, falar com atendente) mas entende texto livre.
3. **Agendamento, remarcação e cancelamento** — via Google Calendar (agenda visual) + Supabase (`schedules`, registro estruturado).
4. **Lembretes e confirmações** — rotina diária automática.
5. **Atendimento humano** — a IA transfere a conversa (`request_human_handoff`) quando solicitado ou quando não consegue ajudar; a equipe assume pelo próprio WhatsApp.
6. **CRM web** (Fases 1, 2, 3, tela WhatsApp e rodada de refinamento) — login (Supabase Auth), Dashboard (saudação, KPIs, gráfico de faturamento, resumo financeiro), Agenda (grade horária semanal/dia, criação manual de agendamento, remarcar/cancelar por clique), Pacientes, Conversas, Procedimentos, **Financeiro**, **Estoque**, **Usuários**, **Configurações** (dados da clínica + horário de atendimento + preferência de tema) e **WhatsApp** — todos lendo/escrevendo nas mesmas tabelas e serviços do agente, nunca duplicando lógica. CRUD completo (criar/editar/ativar-desativar/excluir, conforme o caso) em Pacientes, Usuários, Procedimentos, Estoque, Financeiro e Conversas. Suporte a **Dark Mode** (paleta própria, não é inversão automática) com preferência salva por dispositivo. O horário de atendimento salvo em Configurações é a fonte real usada pela IA (FAQ e disponibilidade de horários no WhatsApp). Fiel ao protótipo do Claude Design (`CRM Clinica.dc.html`).

## Stack
Node.js + TypeScript, Express, Supabase (PostgreSQL), Google Calendar API, Evolution API (WhatsApp via Baileys), Claude (Anthropic API).

## Setup

### 1. Instalar dependências
```
npm install
```

### 2. Configurar o `.env`
Preencher as variáveis descritas no próprio arquivo `.env` (Anthropic, Evolution API, Google Calendar, Supabase).

### 3. Supabase
1. Criar um projeto em [supabase.com](https://supabase.com).
2. Rodar o SQL de [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql) no editor SQL do Supabase (cria as tabelas `users`, `schedules`, `conversations`, `messages`, `procedures` e faz o seed inicial de procedimentos/valores).
3. Preencher `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` no `.env` (Project Settings → API — usar a **service_role key**, nunca a `anon` key, pois o backend precisa de acesso total às tabelas).

### 4. Google Calendar
1. Criar um projeto no [Google Cloud Console](https://console.cloud.google.com/) e ativar a **Google Calendar API**.
2. Criar uma credencial OAuth do tipo **Desktop app** e baixar o JSON como `credentials.json` na raiz do projeto (não versionar — já está no `.gitignore`).
3. Rodar `npm run google:auth` — abrirá uma URL para autorizar o acesso; após autorizar, um `token.json` é salvo automaticamente.
4. Definir `GOOGLE_CALENDAR_ID` no `.env` (`primary` para o calendário principal da conta autenticada, ou o ID de um calendário dedicado da clínica).

### 5. Evolution API (WhatsApp)
Requer uma instância da [Evolution API](https://github.com/EvolutionAPI/evolution-api) já rodando (self-host via Docker) com um número conectado via QR Code.

### 6. Ambiente de desenvolvimento (ngrok)
Para receber webhooks localmente:
```
npm run dev
ngrok http 5000
```
Configure o webhook da instância Evolution API para apontar para a URL pública do ngrok + `/webhook` (ex: `https://xxxx.ngrok.io/webhook`), escutando o evento `messages.upsert`.

### 7. Rodar em produção
```
npm run build
npm start
```
Endpoint de health check: `GET /health`.

### 8. CRM web
1. Rodar o SQL de [supabase/migrations/004_staff.sql](supabase/migrations/004_staff.sql) (cria a tabela `staff`, separada de `users` que são os pacientes do WhatsApp).
2. Criar o primeiro usuário admin do CRM:
   ```
   npm run staff:create -- --email dra@clinica.com --password "senha-forte" --name "Dra. Cristiane Zangelmi" [--role admin|recepcionista|profissional]
   ```
   (`--role` é opcional, default `admin`. Não há convite por e-mail pela própria tela do CRM — usuários adicionais são criados por este script.)
2b. Rodar também [006_transactions.sql](supabase/migrations/006_transactions.sql), [007_inventory.sql](supabase/migrations/007_inventory.sql), [008_clinic_settings.sql](supabase/migrations/008_clinic_settings.sql) e [009_staff_active.sql](supabase/migrations/009_staff_active.sql) (Fase 3 — Financeiro, Estoque, Configurações e desativação de usuários).
3. Instalar e configurar o frontend para desenvolvimento local:
   ```
   cd web
   npm install
   cp .env.example .env   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Project Settings -> API -> anon public key; e' publica por design, protegida por RLS)
   npm run dev             # roda em http://localhost:5173, com proxy /api -> http://localhost:5000
   ```
4. Em produção, o build do frontend (`web/dist`) é gerado pelo `Dockerfile` (estágio `web-build`) e servido pelo próprio Express em `/` — nenhum serviço novo no EasyPanel. As variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` já vêm com valor padrão bakeado no `Dockerfile` (são públicas, não segredos) — só editar o `Dockerfile` se o projeto Supabase mudar; não é preciso configurar build args na UI do EasyPanel.

### 9. Lembretes diários
Já rodam automaticamente in-process (todo dia útil às 08:00, horário de São Paulo) enquanto o servidor estiver de pé — ver `src/cron/reminderCron.ts`. Alternativa via cron/Task Scheduler do sistema operacional, sem depender do servidor:
```
npm run reminders
```

## Estrutura
```
src/
  server.ts                       # entry point (Express + cron)
  config/env.ts                   # variaveis de ambiente
  types/index.ts                  # tipos compartilhados
  controllers/
    webhookController.ts          # recebe mensagens do WhatsApp
    healthController.ts
    api/                          # controllers da API do CRM (dashboard, schedule, patient, conversation, procedure, finance, inventory, staff, settings, whatsapp)
  routes/api.ts                   # monta /api/v1/* sob requireAuth
  middleware/requireAuth.ts       # valida o JWT do Supabase Auth (sessao do CRM) + bloqueia staff.active=false
  middleware/requireAdmin.ts      # restringe rotas (Usuarios) a staff.role='admin'
  services/
    userService.ts                # identificacao/criacao de cliente
    schedulingService.ts          # orquestra Google Calendar + Supabase (usado pelo WhatsApp E pelo CRM)
    reminderService.ts            # rotina de lembretes
    inventoryService.ts           # orquestra movimentacao de estoque (valida saldo, atualiza quantidade)
    businessHoursService.ts       # horario de atendimento real (cache 60s) - usado pelo Calendar E pelo prompt da IA
  conversation/                   # maquina de estados do atendimento
    engine.ts                     # orquestra o loop de tool-use com Claude, uma etapa por vez
    confirmations.ts              # deteccao deterministica de confirmacao/desistencia
    prompt.ts                     # regras globais + textos institucionais
    types.ts                      # StepDefinition, FlowContext, StepResult
    steps/
      menu.ts                     # atendimento geral / FAQ / gatilhos dos fluxos
      scheduling.ts                # agendamento (procedimento -> nome -> data -> horario -> confirmacao)
      rescheduling.ts              # remarcacao
      cancellation.ts              # cancelamento
      index.ts                    # registro central de todas as etapas
  repositories/
    userRepository.ts              # pacientes (+ listAll/count para o CRM)
    scheduleRepository.ts          # agendamentos (+ findByDateRange para a Agenda)
    conversationRepository.ts      # conversas/mensagens (+ listRecent para o Dashboard)
    staffRepository.ts             # equipe do CRM (Supabase Auth)
    procedureRepository.ts         # catalogo de procedimentos (CRM)
    transactionRepository.ts       # receitas/despesas (Financeiro)
    inventoryRepository.ts         # itens e movimentacoes de estoque
    settingsRepository.ts          # dados da clinica + horario de atendimento (business_hours)
  integrations/
    evolutionApiClient.ts
    googleCalendarClient.ts
    anthropicClient.ts
    supabaseClient.ts
  utils/logger.ts                 # logging estruturado (info/warn/error)
  cron/reminderCron.ts            # agendamento in-process (node-cron)
  jobs/sendReminders.ts           # execucao manual/externa dos lembretes
web/                               # CRM web (Vite + React + TS)
  src/
    lib/supabaseClient.ts, api.ts # auth direto no Supabase + fetch client p/ /api/v1
    context/AuthContext.tsx, ThemeContext.tsx, AppointmentModalContext.tsx
    components/Layout.tsx, Topbar.tsx, ProtectedRoute.tsx, NewAppointmentModal.tsx, icons.tsx
    pages/Login.tsx, Dashboard.tsx, Agenda.tsx, Pacientes.tsx, Conversas.tsx, Procedimentos.tsx,
    pages/Financeiro.tsx, Estoque.tsx, Usuarios.tsx, Configuracoes.tsx, WhatsApp.tsx
scripts/
  googleAuthSetup.ts               # setup unico do OAuth do Google
  createStaffAdmin.ts              # cria o primeiro usuario admin do CRM
supabase/migrations/
  001_init.sql                     # schema base (users, schedules, conversations, messages, procedures)
  002_conversation_inactivity.sql  # campos de inatividade + status "closed"
  003_conversation_state.sql       # state/state_data (maquina de estados)
  004_staff.sql                    # tabela staff (CRM), vinculada ao Supabase Auth
  005_procedures_extra.sql         # duration_minutes/active em procedures (CRM)
  006_transactions.sql             # receitas/despesas (Financeiro)
  007_inventory.sql                # inventory_items + inventory_movements (Estoque)
  008_clinic_settings.sql          # clinic_settings + business_hours (Configuracoes, fonte real p/ a IA)
  009_staff_active.sql             # staff.active (desativar acesso sem apagar a conta)
  010_automation_flags.sql         # clinic_settings.reminders_enabled / inactivity_nudge_enabled (tela WhatsApp)
  011_schedule_notes_patient_fields.sql # schedules.notes + users.active/email (agendamento manual, CRUD de pacientes)
workflows/
  atendimento_faq.md              # persona, dados da clinica, tratamentos, valores, objecoes, menu
  agendamento_consultas.md        # fluxo de marcar/remarcar/cancelar consultas
  lembretes_confirmacoes.md       # fluxo de lembretes automaticos
.env                              # chaves e configuracao (nao versionar)
credentials.json, token.json      # OAuth do Google (nao versionar)
```

## Limitações da versão inicial
- Cada usuário tem uma única "conversa" contínua no Supabase (sem conceito de sessão/expiração) — simples e suficiente para o volume esperado, mas pode ser revisitado se necessário.
- Handoff humano muda o status da conversa para `human` e a IA para de responder automaticamente; a equipe assume/devolve a conversa pela tela **Conversas** do CRM (ou manualmente no Supabase, se preferir).
- Lista de objeções em `workflows/atendimento_faq.md` é um rascunho inicial baseado no setor; revisar com a Dra. Cristiane.
