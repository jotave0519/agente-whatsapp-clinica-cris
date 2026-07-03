-- Observacoes livres no agendamento (usado pelo modal "Novo agendamento" do CRM).
alter table schedules add column if not exists notes text;

-- Campos adicionais de paciente para a tela Pacientes do CRM (criar/editar/ativar-desativar).
alter table users add column if not exists active boolean not null default true;
alter table users add column if not exists email text;
