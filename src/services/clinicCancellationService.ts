import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as conversationRepository from "../repositories/conversationRepository";
import { Schedule } from "../types";
import { logger } from "../utils/logger";
import * as aiKnowledgeService from "./aiKnowledgeService";

const SCOPE = "clinicCancellationService";

/**
 * Disparado quando a PROPRIA CLINICA cancela um agendamento pelo CRM
 * (src/controllers/api/scheduleController.ts::cancelSchedule) - avisa o
 * cliente automaticamente pelo WhatsApp e deixa a conversa pronta para a IA
 * conduzir a remarcacao na proxima mensagem dele, sem perguntar de novo nome/
 * procedimento/duracao. NAO deve ser chamado quando o proprio cliente cancela
 * via IA (src/conversation/steps/cancellation.ts) - nesse caso ele ja sabe
 * que cancelou, nao faz sentido avisa-lo do proprio cancelamento.
 */
export async function notifyAndOfferReschedule(schedule: Schedule, reason?: string | null): Promise<void> {
  if (!schedule.phone) {
    logger.warn(SCOPE, "Agendamento sem telefone, nao e possivel notificar", { scheduleId: schedule.id });
    return;
  }

  const [year, month, day] = schedule.date.split("-");
  const reasonBlock = reason && reason.trim() ? `\n\nMotivo:\n${reason.trim()}` : "";

  const message = await aiKnowledgeService.getMessageTemplate("clinic_initiated_cancellation", {
    patientName: schedule.patient_name.split(" ")[0],
    procedure: schedule.procedure,
    date: `${day}/${month}/${year}`,
    time: schedule.time.slice(0, 5),
    reasonBlock,
  });

  const conversation = await conversationRepository.findOrCreateActiveConversation(schedule.user_id);

  logger.info(SCOPE, "Notificando cliente sobre cancelamento feito pela clinica", {
    scheduleId: schedule.id,
    conversationId: conversation.id,
    userId: schedule.user_id,
    hasReason: !!reasonBlock,
  });

  await sendWhatsAppMessage(schedule.phone, message);
  await conversationRepository.addMessage(conversation.id, "assistant", message);

  // Reabre a conversa (mesmo se estava closed/human) e zera o relogio de
  // inatividade - a equipe acabou de agir sobre esse agendamento
  // especificamente, entao faz sentido a IA assumir esse follow-up agora.
  await conversationRepository.touchUserActivity(conversation.id, true);

  const durationMinutes = (await aiKnowledgeService.findProcedureDuration(schedule.procedure)) ?? undefined;
  await conversationRepository.updateConversationFlow(conversation.id, "CLINIC_CANCELLED_OFFER", {
    name: schedule.patient_name,
    procedure: schedule.procedure,
    durationMinutes,
  });
}
