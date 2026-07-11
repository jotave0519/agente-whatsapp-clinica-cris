import { CLOSE_AFTER_MINUTES, NUDGE_AFTER_MINUTES } from "../config/conversationPolicy";
import * as conversationRepository from "../repositories/conversationRepository";
import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";

const NUDGE_TEXT =
  "😊 Oi! Estou por aqui.\n\nSe ainda desejar continuar seu atendimento, é só responder esta mensagem.";

const CLOSE_TEXT =
  "Como não recebi nenhuma resposta, vou encerrar este atendimento por enquanto.\n\n" +
  "Quando quiser continuar, basta enviar uma nova mensagem. Será um prazer ajudar! 💛";

export async function checkInactivity(): Promise<{ nudged: number; closed: number }> {
  let nudged = 0;
  let closed = 0;

  const toNudge = await conversationRepository.findConversationsNeedingNudge(NUDGE_AFTER_MINUTES);
  for (const conversation of toNudge) {
    if (!conversation.phone) continue;
    try {
      await sendWhatsAppMessage(conversation.phone, NUDGE_TEXT);
      await conversationRepository.addMessage(conversation.id, "assistant", NUDGE_TEXT);
      await conversationRepository.markNudgeSent(conversation.id);
      nudged += 1;
    } catch (err) {
      console.error(`Falha ao enviar nudge de inatividade para ${conversation.phone}:`, err);
    }
  }

  const toClose = await conversationRepository.findConversationsNeedingClose(CLOSE_AFTER_MINUTES);
  for (const conversation of toClose) {
    if (conversation.phone) {
      try {
        await sendWhatsAppMessage(conversation.phone, CLOSE_TEXT);
        await conversationRepository.addMessage(conversation.id, "assistant", CLOSE_TEXT);
      } catch (err) {
        console.error(`Falha ao enviar encerramento por inatividade para ${conversation.phone}:`, err);
      }
    }
    await conversationRepository.updateConversationStatus(conversation.id, "closed");
    closed += 1;
  }

  return { nudged, closed };
}
