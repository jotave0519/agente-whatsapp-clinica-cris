-- Campos adicionais para a tela de Procedimentos do CRM (aditivo, nao mexe
-- nos dados existentes; procedures ja existia desde 001_init.sql).

alter table procedures add column if not exists duration_minutes integer;
alter table procedures add column if not exists active boolean not null default true;
