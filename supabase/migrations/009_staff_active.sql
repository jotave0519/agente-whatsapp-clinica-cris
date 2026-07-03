-- Permite desativar o acesso de um usuario do CRM sem apagar a conta.
alter table staff add column if not exists active boolean not null default true;
