-- Financeiro: receitas e despesas da clinica.

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receita', 'despesa')),
  description text not null,
  category text,
  amount numeric(10,2) not null,
  method text,
  status text not null default 'pago' check (status in ('pago', 'pendente')),
  patient_id uuid references users(id) on delete set null,
  procedure_id uuid references procedures(id) on delete set null,
  occurred_on date not null default current_date,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_occurred_on on transactions(occurred_on);
create index if not exists idx_transactions_type on transactions(type);
