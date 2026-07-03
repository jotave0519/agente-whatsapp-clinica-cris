import { Request, Response } from "express";
import * as conversationRepository from "../../repositories/conversationRepository";
import * as evolutionApiClient from "../../integrations/evolutionApiClient";
import { logger } from "../../utils/logger";

const SCOPE = "api.whatsapp";

export async function getStatus(_req: Request, res: Response): Promise<void> {
  try {
    const [instance, activeConversations] = await Promise.all([
      evolutionApiClient.getInstanceInfo(),
      conversationRepository.countActive(),
    ]);

    res.json({
      connectionStatus: instance.connectionStatus,
      phone: instance.ownerJid ? instance.ownerJid.replace(/@.*/, "") : null,
      profileName: instance.profileName,
      connectedSince: instance.createdAt,
      stats: {
        messages: instance.messageCount,
        contacts: instance.contactCount,
        chats: instance.chatCount,
        activeConversations,
      },
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao buscar status do WhatsApp", err);
    res.status(500).json({ error: "Erro ao buscar status do WhatsApp." });
  }
}

export async function getQrCode(_req: Request, res: Response): Promise<void> {
  try {
    const qr = await evolutionApiClient.getConnectQrCode();
    res.json(qr);
  } catch (err) {
    logger.error(SCOPE, "Erro ao gerar QR code", err);
    res.status(500).json({ error: "Erro ao gerar QR code." });
  }
}

export async function disconnect(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Desconectando instancia via CRM", { staffId: req.staff?.id });
    await evolutionApiClient.disconnectInstance();
    res.json({ status: "disconnected" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao desconectar instancia", err);
    res.status(500).json({ error: "Erro ao desconectar instancia." });
  }
}
