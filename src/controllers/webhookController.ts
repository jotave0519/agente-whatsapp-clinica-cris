import { Request, Response } from "express";
import { parseIncomingWebhook, sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import { getOrCreateUserByPhone } from "../services/userService";
import * as conversationRepository from "../repositories/conversationRepository";
import * as aiAgentService from "../services/aiAgentService";

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const incoming = parseIncomingWebhook(req.body);

  if (!incoming) {
    res.status(200).json({ status: "ignored" });
    return;
  }

  const { phone, text, pushName } = incoming;
  console.log(`Mensagem recebida de ${phone}: ${text}`);

  try {
    const user = await getOrCreateUserByPhone(phone, pushName);
    const conversation = await conversationRepository.findOrCreateActiveConversation(user.id);

    if (conversation.status === "human") {
      await conversationRepository.addMessage(conversation.id, "user", text);
      res.status(200).json({ status: "ok", handled_by: "human" });
      return;
    }

    const { reply } = await aiAgentService.handleMessage(user, conversation, text);
    await sendWhatsAppMessage(phone, reply);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error(`Erro ao processar mensagem de ${phone}:`, err);
    try {
      await sendWhatsAppMessage(
        phone,
        "Desculpe, tive um problema para responder agora. Nossa equipe vai te retornar em breve."
      );
    } catch (sendErr) {
      console.error(`Falha tambem ao enviar mensagem de erro para ${phone}:`, sendErr);
    }
    res.status(200).json({ status: "error" });
  }
}
