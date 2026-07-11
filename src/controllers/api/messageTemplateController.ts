import { Request, Response } from "express";
import * as messageTemplateRepository from "../../repositories/messageTemplateRepository";
import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import { logger } from "../../utils/logger";

const SCOPE = "api.messageTemplate";

export async function listMessageTemplates(_req: Request, res: Response): Promise<void> {
  try {
    const items = await messageTemplateRepository.listAll();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar mensagens automaticas", err);
    res.status(500).json({ error: "Erro ao listar mensagens automaticas." });
  }
}

export async function updateMessageTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { body } = req.body;
    if (typeof body !== "string" || !body.trim()) {
      res.status(400).json({ error: "body e obrigatorio." });
      return;
    }

    logger.info(SCOPE, "Atualizando mensagem automatica via CRM", { staffId: req.staff?.id, key: req.params.key });
    const item = await messageTemplateRepository.updateBody(req.params.key, body);
    aiKnowledgeService.invalidateCache();
    res.json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar mensagem automatica", err);
    res.status(500).json({ error: "Erro ao atualizar mensagem automatica." });
  }
}
