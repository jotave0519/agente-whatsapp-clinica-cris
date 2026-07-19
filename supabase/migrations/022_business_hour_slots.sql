-- Reformula o horario de funcionamento de "abertura/fechamento/almoco" para
-- uma lista explicita de horarios de atendimento por dia da semana, cadastrada
-- manualmente pela clinica - sem geracao automatica de horarios entre
-- abertura e fechamento. Tudo aditivo com preservacao de dados (seed a partir
-- do horario atual) antes de remover as colunas antigas.

create table if not exists business_hour_slots (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null references business_hours(weekday) on delete cascade check (weekday between 0 and 6),
  time time not null,
  created_at timestamptz not null default now(),
  unique (weekday, time)
);
create index if not exists idx_business_hour_slots_weekday on business_hour_slots(weekday, time);

-- Semeia os slots iniciais a partir do open_time/close_time/lunch atuais, em
-- passos de 30 min - a clinica nao perde nenhuma disponibilidade na transicao.
-- IMPORTANTE: gera a serie em timestamp, nunca em `time` puro - `time + interval`
-- no Postgres e aritmetica modulo-24h ("23:00"::time + 2h = "01:00"), o que
-- geraria slots de madrugada espurios se somado direto sobre a coluna `time`.
insert into business_hour_slots (weekday, time)
select bh.weekday, gs::time
from business_hours bh
cross join lateral generate_series(
  ('2000-01-01 ' || bh.open_time)::timestamp,
  ('2000-01-01 ' || bh.close_time)::timestamp - interval '30 minutes',
  interval '30 minutes'
) as gs
where bh.enabled
  and bh.open_time < bh.close_time
  and (
    bh.lunch_start is null or bh.lunch_end is null or bh.lunch_start >= bh.lunch_end
    or gs::time < bh.lunch_start or gs::time >= bh.lunch_end
  )
on conflict (weekday, time) do nothing;

alter table business_hours drop column if exists open_time;
alter table business_hours drop column if exists close_time;
alter table business_hours drop column if exists lunch_start;
alter table business_hours drop column if exists lunch_end;
-- business_hours fica so com: weekday (pk), enabled

-- Excecoes (feriados/bloqueios/dias especiais) mantem a capacidade de horario
-- customizado - troca open_time/close_time (intervalo continuo) por um array
-- de horarios explicitos, mesmo espirito da tabela semanal. NULL = "sem
-- personalizacao, usa os slots normais da semana quando nao estiver fechado".
alter table business_hour_exceptions add column if not exists slots jsonb;

update business_hour_exceptions
set slots = (
  select jsonb_agg(to_char(gs, 'HH24:MI') order by gs)
  from generate_series(
    ('2000-01-01 ' || open_time)::timestamp,
    ('2000-01-01 ' || close_time)::timestamp - interval '30 minutes',
    interval '30 minutes'
  ) as gs
)
where closed = false and open_time is not null and close_time is not null and open_time < close_time;

alter table business_hour_exceptions drop column if exists open_time;
alter table business_hour_exceptions drop column if exists close_time;
