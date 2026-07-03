-- Equipe da clinica (usuarios do CRM web), separada da tabela "users" (que
-- representa pacientes/contatos do WhatsApp). Vinculada ao Supabase Auth.

create table if not exists staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'recepcionista' check (role in ('admin', 'recepcionista', 'profissional')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_email on staff(email);
