import { CLOSE_AFTER_MINUTES, NUDGE_AFTER_MINUTES } from "../config/conversationPolicy";
import * as conversationRepository from "../repositories/conversationRepository";
import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as aiKnowledgeService from "./aiKnowledgeService";

export async function checkInactivity(): Promise<{ nudged: number; closed: number }> {
  let nudged = 0;
  let closed = 0;

  const toNudge = await conversationRepository.findConversationsNeedingNudge(NUDGE_AFTER_MINUTES);
  if (toNudge.length > 0) {
    const nudgeText = await aiKnowledgeService.getMessageTemplate("nudge_inactivity");
    for (const conversation of toNudge) {
      if (!conversation.phone) continue;
      try {
        await sendWhatsAppMessage(conversation.phone, nudgeText);
        await conversationRepository.addMessage(conversation.id, "assistant", nudgeText);
        await conversationRepository.markNudgeSent(conversation.id);
        nudged += 1;
      } catch (err) {
        console.error(`Falha ao enviar nudge de inatividade para ${conversation.phone}:`, err);
      }
    }
  }

  const toClose = await conversationRepository.findConversationsNeedingClose(CLOSE_AFTER_MINUTES);
  if (toClose.length > 0) {
    const closeText = await aiKnowledgeService.getMessageTemplate("close_inactivity");
    for (const conversation of toClose) {
      if (conversation.phone) {
        try {
          await sendWhatsAppMessage(conversation.phone, closeText);
          await conversationRepository.addMessage(conversation.id, "assistant", closeText);
        } catch (err) {
          console.error(`Falha ao enviar encerramento por inatividade para ${conversation.phone}:`, err);
        }
      }
      await conversationRepository.updateConversationStatus(conversation.id, "closed");
      closed += 1;
    }
  }

  return { nudged, closed };
}
