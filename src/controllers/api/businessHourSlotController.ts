import { Request, Response } from "express";
import * as businessHourSlotRepository from "../../repositories/businessHourSlotRepository";
import * as businessHoursService from "../../services/businessHoursService";
import { logger } from "../../utils/logger";

const SCOPE = "api.businessHourSlot";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function createSlot(req: Request, res: Response): Promise<void> {
  try {
    const { weekday, time } = req.body;
    if (typeof weekday !== "number" || weekday < 0 || weekday > 6 || typeof time !== "string" || !TIME_RE.test(time)) {
      res.status(400).json({ error: "weekday (0-6) e time (HH:MM) sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Adicionando horario de atendimento via CRM", { staffId: req.staff?.id, weekday, time });
    const item = await businessHourSlotRepository.create(weekday, time);
    businessHoursService.invalidateCache();
    res.status(201).json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao adicionar horario de atendimento", err);
    res.status(500).json({ error: "Erro ao adicionar horario de atendimento." });
  }
}

export async function deleteSlot(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Removendo horario de atendimento via CRM", { staffId: req.staff?.id, id: req.params.id });
    await businessHourSlotRepository.remove(req.params.id);
    businessHoursService.invalidateCache();
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao remover horario de atendimento", err);
    res.status(500).json({ error: "Erro ao remover horario de atendimento." });
  }
}
