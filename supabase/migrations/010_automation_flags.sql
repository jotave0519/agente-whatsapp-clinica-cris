-- Toggles reais de automacao (tela WhatsApp do CRM). Default true para nao
-- mudar o comportamento atual (lembretes e nudge de inatividade ja rodam sempre).
alter table clinic_settings add column if not exists reminders_enabled boolean not null default true;
alter table clinic_settings add column if not exists inactivity_nudge_enabled boolean not null default true;
