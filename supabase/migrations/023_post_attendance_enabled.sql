-- Toggle geral de pos-atendimento, no mesmo espirito de reactivation_enabled
-- (019) e commercial_ai_enabled (021) - hoje o "desligar" so existia fluxo a
-- fluxo. Default true preserva o comportamento atual sem excecao.
alter table clinic_settings add column if not exists post_attendance_enabled boolean not null default true;
