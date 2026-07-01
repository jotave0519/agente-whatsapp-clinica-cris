-- Rodar este SQL no editor SQL do Supabase (ou via CLI) para criar o schema inicial.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  patient_name text not null,
  phone text not null,
  procedure text not null,
  date date not null,
  time time not null,
  google_event_id text,
  status text not null default 'Agendado' check (status in ('Agendado', 'Cancelado', 'Concluido')),
  reminder_sent boolean not null default false,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schedules_user_id on schedules(user_id);
create index if not exists idx_schedules_status on schedules(status);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'ai' check (status in ('ai', 'human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_id on conversations(user_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_id on messages(conversation_id);

create table if not exists procedures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  price numeric,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed inicial dos procedimentos/valores conhecidos (ver workflows/atendimento_faq.md)
insert into procedures (name, category, price, description) values
  ('Limpeza de Pele', 'Facial', 150, 'Sessao de limpeza de pele'),
  ('Botox', 'Facial', 800, 'Inclui avaliacao gratuita, retorno incluso e produtos premium'),
  ('Preenchimento com Acido Hialuronico', 'Facial', 1200, 'Valor sujeito a avaliacao presencial'),
  ('Harmonizacao Facial', 'Facial', null, 'Valor definido apos avaliacao personalizada'),
  ('Rejuvenescimento Facial', 'Facial', null, 'Valor definido apos avaliacao personalizada'),
  ('Estetica Corporal', 'Corporal', null, 'Valor definido apos avaliacao personalizada'),
  ('Contorno Corporal', 'Corporal', null, 'Valor definido apos avaliacao personalizada'),
  ('Reducao de Medidas', 'Corporal', null, 'Valor definido apos avaliacao personalizada')
on conflict do nothing;
