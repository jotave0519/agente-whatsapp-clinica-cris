# Agente de WhatsApp — Dra. Cristiane Zangelmi (Estética Avançada)

Sistema de atendimento inteligente via WhatsApp, construído no framework **WAT** (ver [claude.md](claude.md)):
- `workflows/` — instruções (SOPs) que o agente de IA segue
- `src/` — código TypeScript, organizado em camadas:
  - `controllers/` — recebem requisições HTTP (webhook, health check)
  - `services/` — regras de negócio (agente de IA, agendamento, lembretes, usuários)
  - `repositories/` — acesso ao Supabase
  - `integrations/` — clients externos (Evolution API, Google Calendar, Anthropic, Supabase)
  - `cron/`, `jobs/` — rotina agendada de lembretes

## Funcionalidades
1. **Identificação automática do cliente** — cria/recupera o registro em `users` (Supabase) pelo telefone recebido no webhook.
2. **Atendimento inicial com menu + linguagem natural** — apresenta opções (agendar, remarcar, cancelar, tratamentos, falar com atendente) mas entende texto livre.
3. **Agendamento, remarcação e cancelamento** — via Google Calendar (agenda visual) + Supabase (`schedules`, registro estruturado).
4. **Lembretes e confirmações** — rotina diária automática.
5. **Atendimento humano** — a IA transfere a conversa (`request_human_handoff`) quando solicitado ou quando não consegue ajudar; a equipe assume pelo próprio WhatsApp.

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

### 8. Lembretes diários
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
  services/
    userService.ts                # identificacao/criacao de cliente
    schedulingService.ts          # orquestra Google Calendar + Supabase
    aiAgentService.ts             # loop de tool-use com Claude
    reminderService.ts            # rotina de lembretes
  repositories/
    userRepository.ts
    scheduleRepository.ts
    conversationRepository.ts
  integrations/
    evolutionApiClient.ts
    googleCalendarClient.ts
    anthropicClient.ts
    supabaseClient.ts
  cron/reminderCron.ts            # agendamento in-process (node-cron)
  jobs/sendReminders.ts           # execucao manual/externa dos lembretes
scripts/googleAuthSetup.ts        # setup unico do OAuth do Google
supabase/migrations/001_init.sql  # schema do banco
workflows/
  atendimento_faq.md              # persona, dados da clinica, tratamentos, valores, objecoes, menu
  agendamento_consultas.md        # fluxo de marcar/remarcar/cancelar consultas
  lembretes_confirmacoes.md       # fluxo de lembretes automaticos
.env                              # chaves e configuracao (nao versionar)
credentials.json, token.json      # OAuth do Google (nao versionar)
```

## Limitações da versão inicial
- Cada usuário tem uma única "conversa" contínua no Supabase (sem conceito de sessão/expiração) — simples e suficiente para o volume esperado, mas pode ser revisitado se necessário.
- Handoff humano muda o status da conversa para `human` e a IA para de responder automaticamente; não há um mecanismo de UI para a equipe "devolver" a conversa para a IA — isso precisa ser feito manualmente (ex: update direto no Supabase) até que exista um painel administrativo.
- Lista de objeções em `workflows/atendimento_faq.md` é um rascunho inicial baseado no setor; revisar com a Dra. Cristiane.
