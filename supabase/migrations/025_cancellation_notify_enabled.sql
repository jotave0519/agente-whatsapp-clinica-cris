-- Toggle pro aviso automatico ao paciente quando a clinica cancela um
-- agendamento pelo CRM (clinicCancellationService.notifyAndOfferReschedule),
-- no mesmo espirito de post_attendance_enabled (023). Default true preserva
-- o comportamento atual sem excecao.
alter table clinic_settings add column if not exists cancellation_notify_enabled boolean not null default true;
