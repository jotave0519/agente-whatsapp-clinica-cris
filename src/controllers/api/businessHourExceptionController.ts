import { Request, Response } from "express";
import * as businessHourExceptionRepository from "../../repositories/businessHourExceptionRepository";
import * as businessHoursService from "../../services/businessHoursService";
import { logger } from "../../utils/logger";

const SCOPE = "api.businessHourException";

export async function listExceptions(_req: Request, res: Response): Promise<void> {
  try {
    const items = await businessHourExceptionRepository.listAll();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar excecoes de horario", err);
    res.status(500).json({ error: "Erro ao listar excecoes de horario." });
  }
}

export async function createException(req: Request, res: Response): Promise<void> {
  try {
    const { date, type, closed, slots, note } = req.body;
    if (!date || !type) {
      res.status(400).json({ error: "date e type sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Criando excecao de horario via CRM", { staffId: req.staff?.id, date, type });
    const item = await businessHourExceptionRepository.create({ date, type, closed, slots, note });
    businessHoursService.invalidateCache();
    res.status(201).json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar excecao de horario", err);
    res.status(500).json({ error: "Erro ao criar excecao de horario." });
  }
}

export async function deleteException(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Excluindo excecao de horario via CRM", { staffId: req.staff?.id, id: req.params.id });
    await businessHourExceptionRepository.remove(req.params.id);
    businessHoursService.invalidateCache();
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir excecao de horario", err);
    res.status(500).json({ error: "Erro ao excluir excecao de horario." });
  }
}
