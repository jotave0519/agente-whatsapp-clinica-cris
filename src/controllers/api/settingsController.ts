import { Request, Response } from "express";
import * as settingsRepository from "../../repositories/settingsRepository";
import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as businessHoursService from "../../services/businessHoursService";
import { logger } from "../../utils/logger";

const SCOPE = "api.settings";

export async function getSettings(_req: Request, res: Response): Promise<void> {
  try {
    const [clinic, businessHours] = await Promise.all([settingsRepository.getClinicSettings(), settingsRepository.getBusinessHours()]);
    res.json({ clinic, businessHours });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar configuracoes", err);
    res.status(500).json({ error: "Erro ao carregar configuracoes." });
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const { clinic, businessHours } = req.body;
    logger.info(SCOPE, "Atualizando configuracoes via CRM", { staffId: req.staff?.id });

    const [updatedClinic, updatedHours] = await Promise.all([
      clinic ? settingsRepository.updateClinicSettings(clinic) : settingsRepository.getClinicSettings(),
      businessHours ? settingsRepository.updateBusinessHours(businessHours) : settingsRepository.getBusinessHours(),
    ]);

    if (businessHours) businessHoursService.invalidateCache();
    if (clinic) aiKnowledgeService.invalidateCache();

    res.json({ clinic: updatedClinic, businessHours: updatedHours });
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar configuracoes", err);
    res.status(500).json({ error: "Erro ao atualizar configuracoes." });
  }
}
