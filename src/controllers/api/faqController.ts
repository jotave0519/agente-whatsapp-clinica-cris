import { Request, Response } from "express";
import * as faqRepository from "../../repositories/faqRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.faq";

function isDuplicateQuestion(err: any): boolean {
  return err?.code === "23505";
}

export async function listFaq(_req: Request, res: Response): Promise<void> {
  try {
    const items = await faqRepository.listAll();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar FAQ", err);
    res.status(500).json({ error: "Erro ao listar FAQ." });
  }
}

export async function createFaq(req: Request, res: Response): Promise<void> {
  try {
    const { question, answer, active, sort_order } = req.body;
    if (!question) {
      res.status(400).json({ error: "question e obrigatorio." });
      return;
    }

    logger.info(SCOPE, "Criando pergunta de FAQ via CRM", { staffId: req.staff?.id });
    const item = await faqRepository.create({ question, answer, active, sort_order });
    res.status(201).json(item);
  } catch (err) {
    if (isDuplicateQuestion(err)) {
      res.status(409).json({ error: "Essa pergunta já está cadastrada." });
      return;
    }
    logger.error(SCOPE, "Erro ao criar FAQ", err);
    res.status(500).json({ error: "Erro ao criar FAQ." });
  }
}

export async function updateFaq(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Atualizando FAQ via CRM", { staffId: req.staff?.id, id: req.params.id });
    const item = await faqRepository.update(req.params.id, req.body);
    res.json(item);
  } catch (err) {
    if (isDuplicateQuestion(err)) {
      res.status(409).json({ error: "Essa pergunta já está cadastrada." });
      return;
    }
    logger.error(SCOPE, "Erro ao atualizar FAQ", err);
    res.status(500).json({ error: "Erro ao atualizar FAQ." });
  }
}

export async function deleteFaq(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Excluindo FAQ via CRM", { staffId: req.staff?.id, id: req.params.id });
    await faqRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir FAQ", err);
    res.status(500).json({ error: "Erro ao excluir FAQ." });
  }
}
