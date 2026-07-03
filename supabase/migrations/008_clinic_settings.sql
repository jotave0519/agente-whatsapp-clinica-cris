-- Configuracoes: dados da clinica (linha unica) e horario de atendimento
-- (7 linhas, uma por dia da semana). Seedadas com os valores hoje fixos no
-- codigo (seg-sex 08:00-18:00, fechado sab/dom) para nao mudar comportamento
-- no deploy desta migracao.

create table if not exists clinic_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'Dra. Cristiane Zangelmi',
  phone text,
  email text,
  address text,
  updated_at timestamptz not null default now()
);

insert into clinic_settings (id, name, phone, email, address)
values (1, 'Dra. Cristiane Zangelmi', '(11) 91130-5969', 'contato@esteticazangelmi.com', 'Estrada Santa Isabel, 965, Sala 23, Edificio Comercial Arujazinho, Aruja - SP, CEP 07434-100')
on conflict (id) do nothing;

create table if not exists business_hours (
  weekday integer primary key check (weekday between 0 and 6),
  enabled boolean not null default true,
  open_time time not null default '08:00',
  close_time time not null default '18:00'
);

insert into business_hours (weekday, enabled, open_time, close_time) values
  (0, false, '08:00', '18:00'),
  (1, true, '08:00', '18:00'),
  (2, true, '08:00', '18:00'),
  (3, true, '08:00', '18:00'),
  (4, true, '08:00', '18:00'),
  (5, true, '08:00', '18:00'),
  (6, false, '08:00', '18:00')
on conflict (weekday) do nothing;
