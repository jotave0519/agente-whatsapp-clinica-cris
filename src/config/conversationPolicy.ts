/**
 * Politica de inatividade das conversas do WhatsApp: apos quantos minutos sem
 * resposta o cliente recebe um lembrete, e depois disso quanto tempo ate a
 * conversa ser encerrada automaticamente. Usado por
 * src/services/inactivityService.ts (cron de inatividade).
 *
 * O tempo de expiracao de CONTEXTO de um fluxo de agendamento incompleto (ex:
 * cliente some no meio de um agendamento e volta dias depois) e um campo
 * separado e editavel pelo CRM - clinic_settings.context_expiry_minutes, lido
 * via src/services/aiKnowledgeService.ts::getContextExpiryMinutes() - e nao
 * depende mais destas constantes.
 */
export const NUDGE_AFTER_MINUTES = 5;
export const CLOSE_AFTER_MINUTES = 5;
