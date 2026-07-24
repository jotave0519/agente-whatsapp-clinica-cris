-- Ficha Completa do Paciente: profissional responsavel, regra de retorno
-- recomendado, notas clinicas, objetivos, fotos antes/depois, documentos e
-- eventos manuais de timeline. Tudo aditivo - nao altera nenhum fluxo
-- existente de agendamento/WhatsApp/Google Calendar/financeiro.

alter table schedules add column if not exists staff_id uuid references staff(id) on delete set null;
alter table procedures add column if not exists recommended_interval_days integer;
alter table users add column if not exists photo_path text;

create table if not exists patient_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  author_staff_id uuid references staff(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists patient_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  description text not null,
  status text not null default 'ativo' check (status in ('ativo', 'concluido')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists patient_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  schedule_id uuid references schedules(id) on delete set null,
  kind text not null check (kind in ('antes', 'depois')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists patient_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  category text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- So para eventos MANUAIS adicionados na ficha - a timeline agrega em tempo
-- de leitura schedule_events/transactions/patient_notes/patient_goals/
-- patient_media/patient_documents junto com esta tabela, nunca duplicando.
create table if not exists patient_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  detail text,
  occurred_at timestamptz not null default now(),
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_notes_user on patient_notes(user_id, created_at);
create index if not exists idx_patient_goals_user on patient_goals(user_id);
create index if not exists idx_patient_media_user on patient_media(user_id, created_at);
create index if not exists idx_patient_documents_user on patient_documents(user_id, created_at);
create index if not exists idx_patient_timeline_events_user on patient_timeline_events(user_id, occurred_at);

-- Buckets de Storage para fotos antes/depois e documentos do paciente. O
-- navegador sobe os arquivos direto pro Storage (usando a sessao ja
-- autenticada do staff) - o backend so guarda a metadata (path/tipo/paciente).
insert into storage.buckets (id, name, public)
values ('patient-media', 'patient-media', false), ('patient-documents', 'patient-documents', false)
on conflict (id) do nothing;

drop policy if exists "staff manages patient media" on storage.objects;
create policy "staff manages patient media" on storage.objects for all
  using (bucket_id = 'patient-media' and exists (select 1 from staff where staff.id = auth.uid()))
  with check (bucket_id = 'patient-media' and exists (select 1 from staff where staff.id = auth.uid()));

drop policy if exists "staff manages patient documents" on storage.objects;
create policy "staff manages patient documents" on storage.objects for all
  using (bucket_id = 'patient-documents' and exists (select 1 from staff where staff.id = auth.uid()))
  with check (bucket_id = 'patient-documents' and exists (select 1 from staff where staff.id = auth.uid()));
