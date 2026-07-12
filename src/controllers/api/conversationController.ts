import { Request, Response } from "express";
import * as conversationRepository from "../../repositories/conversationRepository";
import { sendWhatsAppMessage } from "../../integrations/evolutionApiClient";
import { logger } from "../../utils/logger";

const SCOPE = "api.conversation";

export async function listConversations(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const result = await conversationRepository.listConversations({ limit, offset });
    res.json(result);
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar conversas", err);
    res.status(500).json({ error: "Erro ao listar conversas." });
  }
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  try {
    const conversation = await conversationRepository.findConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversa nao encontrada." });
      return;
    }
    const messages = await conversationRepository.listMessages(conversation.id, 200);
    res.json({ conversation, messages });
  } catch (err) {
    logger.error(SCOPE, "Erro ao buscar conversa", err);
    res.status(500).json({ error: "Erro ao buscar conversa." });
  }
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: "content e obrigatorio." });
      return;
    }

    const conversation = await conversationRepository.findConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversa nao encontrada." });
      return;
    }

    logger.info(SCOPE, "Enviando mensagem manual via CRM", { staffId: req.staff?.id, conversationId: conversation.id });
    await sendWhatsAppMessage(conversation.userPhone, content);
    // Nao altera conversation.status: enviar uma mensagem manual nao e, por si so, uma
    // transferencia para atendimento humano. Isso so acontece via acao explicita (o toggle
    // "Assumir conversa" na tela, que chama updateStatus) ou via request_human_handoff da IA.
    // Sem essa separacao, uma unica mensagem manual desligava a IA silenciosamente ate alguem
    // notar e devolver a conversa manualmente.
    const message = await conversationRepository.addMessage(conversation.id, "assistant", content);

    res.status(201).json(message);
  } catch (err) {
    logger.error(SCOPE, "Erro ao enviar mensagem", err);
    res.status(500).json({ error: "Erro ao enviar mensagem." });
  }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (status !== "ai" && status !== "human" && status !== "closed") {
      res.status(400).json({ error: "status deve ser 'ai', 'human' ou 'closed'." });
      return;
    }

    logger.info(SCOPE, "Alterando status da conversa via CRM", { staffId: req.staff?.id, conversationId: req.params.id, status });
    await conversationRepository.updateConversationStatus(req.params.id, status);
    res.json({ status: "ok" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar status da conversa", err);
    res.status(500).json({ error: "Erro ao atualizar status da conversa." });
  }
}
