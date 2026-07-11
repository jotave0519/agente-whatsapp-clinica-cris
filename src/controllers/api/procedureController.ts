import { Request, Response } from "express";
import * as procedureRepository from "../../repositories/procedureRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.procedure";

export async function listProcedures(_req: Request, res: Response): Promise<void> {
  try {
    const items = await procedureRepository.listAll();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar procedimentos", err);
    res.status(500).json({ error: "Erro ao listar procedimentos." });
  }
}

export async function createProcedure(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, price, description, duration_minutes, notes, pre_instructions, post_instructions, active } = req.body;
    if (!name) {
      res.status(400).json({ error: "name e obrigatorio." });
      return;
    }

    logger.info(SCOPE, "Criando procedimento via CRM", { staffId: req.staff?.id, name });
    const procedure = await procedureRepository.create({
      name,
      category,
      price,
      description,
      duration_minutes,
      notes,
      pre_instructions,
      post_instructions,
      active,
    });
    res.status(201).json(procedure);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar procedimento", err);
    res.status(500).json({ error: "Erro ao criar procedimento." });
  }
}

export async function updateProcedure(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Atualizando procedimento via CRM", { staffId: req.staff?.id, id: req.params.id });
    const procedure = await procedureRepository.update(req.params.id, req.body);
    res.json(procedure);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar procedimento", err);
    res.status(500).json({ error: "Erro ao atualizar procedimento." });
  }
}

export async function deleteProcedure(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Excluindo procedimento via CRM", { staffId: req.staff?.id, id: req.params.id });
    await procedureRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir procedimento", err);
    res.status(500).json({ error: "Erro ao excluir procedimento." });
  }
}
