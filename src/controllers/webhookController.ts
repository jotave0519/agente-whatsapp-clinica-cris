import { Request, Response } from "express";
import { parseIncomingWebhook, sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import { getOrCreateUserByPhone } from "../services/userService";
import * as conversationRepository from "../repositories/conversationRepository";
import * as conversationEngine from "../conversation/engine";
import { logger } from "../utils/logger";

const SCOPE = "webhookController";

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  logger.info(SCOPE, "Webhook recebido", { body: req.body });

  const incoming = parseIncomingWebhook(req.body);

  if (!incoming) {
    logger.info(SCOPE, "Evento ignorado (nao e mensagem de texto recebida)");
    res.status(200).json({ status: "ignored" });
    return;
  }

  const { phone, text, pushName } = incoming;
  logger.info(SCOPE, "Mensagem recebida", { phone, text, pushName });

  try {
    const user = await getOrCreateUserByPhone(phone, pushName);
    logger.info(SCOPE, "Usuario resolvido", { userId: user.id, phone: user.phone, name: user.name });

    const conversation = await conversationRepository.findOrCreateActiveConversation(user.id);
    logger.info(SCOPE, "Conversa resolvida", {
      conversationId: conversation.id,
      status: conversation.status,
      state: conversation.state,
      stateData: conversation.state_data,
    });

    const wasClosed = conversation.status === "closed";
    await conversationRepository.touchUserActivity(conversation.id, wasClosed);
    if (wasClosed) {
      logger.info(SCOPE, "Conversa estava encerrada - sera reaberta e o fluxo de atendimento reiniciado", { conversationId: conversation.id });
    }

    // Nao sobrescrevemos conversation.status em memoria mesmo apos reabrir no banco:
    // o engine usa o status original ("closed") para saber que o contexto expirou e
    // reiniciar o fluxo. Isso e seguro aqui porque "closed" nunca e igual a "human".
    if (conversation.status === "human") {
      logger.info(SCOPE, "Conversa em atendimento humano - mensagem apenas registrada", { conversationId: conversation.id });
      await conversationRepository.addMessage(conversation.id, "user", text);
      res.status(200).json({ status: "ok", handled_by: "human" });
      return;
    }

    logger.info(SCOPE, "Encaminhando para conversationEngine.runTurn", { conversationId: conversation.id, state: conversation.state });
    const { reply, handoffRequested } = await conversationEngine.runTurn(user, conversation, text);
    logger.info(SCOPE, "Resposta gerada pelo agente", { conversationId: conversation.id, handoffRequested, reply });

    await sendWhatsAppMessage(phone, reply);
    logger.info(SCOPE, "Resposta enviada via Evolution API", { phone });

    res.status(200).json({ status: "ok" });
  } catch (err) {
    logger.error(SCOPE, `Erro ao processar mensagem de ${phone}`, err);
    try {
      await sendWhatsAppMessage(
        phone,
        "Desculpe, tive um problema para responder agora. Nossa equipe vai te retornar em breve."
      );
    } catch (sendErr) {
      logger.error(SCOPE, `Falha tambem ao enviar mensagem de erro para ${phone}`, sendErr);
    }
    res.status(200).json({ status: "error" });
  }
}
