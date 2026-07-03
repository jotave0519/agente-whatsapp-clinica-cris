-- Estoque: produtos/insumos da clinica e historico de movimentacoes.

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  unit text not null default 'un',
  quantity numeric(10,2) not null default 0,
  min_quantity numeric(10,2) not null default 0,
  expiry_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  type text not null check (type in ('entrada', 'saida')),
  quantity numeric(10,2) not null,
  note text,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_item on inventory_movements(item_id);
