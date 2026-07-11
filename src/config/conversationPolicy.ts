/**
 * Politica de inatividade/expiracao de contexto das conversas do WhatsApp.
 * Fonte unica de verdade usada tanto pelo cron de inatividade
 * (src/services/inactivityService.ts, que envia o nudge e encerra a
 * conversa) quanto pelo motor de conversa (src/conversation/engine.ts, que
 * decide se reinicia o fluxo de atendimento ao retomar uma conversa antiga).
 */
export const NUDGE_AFTER_MINUTES = 5;
export const CLOSE_AFTER_MINUTES = 5;

/** Tempo total sem resposta do cliente apos o qual a conversa e considerada encerrada. */
export const CONTEXT_EXPIRY_MINUTES = NUDGE_AFTER_MINUTES + CLOSE_AFTER_MINUTES;
