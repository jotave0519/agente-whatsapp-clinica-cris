import { Request, Response } from "express";
import * as commercialEventRepository from "../../repositories/commercialEventRepository";
import * as commercialOpportunityRepository from "../../repositories/commercialOpportunityRepository";
import * as commercialEngine from "../../services/commercialEngine";
import { CommercialOpportunityStage } from "../../types";
import { logger } from "../../utils/logger";

const SCOPE = "api.commercial";

const VALID_STAGES: CommercialOpportunityStage[] = [
  "new_interest",
  "evaluation_scheduled",
  "evaluation_done",
  "awaiting_decision",
  "follow_up_active",
  "procedure_scheduled",
  "converted",
  "lost",
];

export async function listOpportunities(_req: Request, res: Response): Promise<void> {
  try {
    // Por padrao inclui terminais (convertido/perdido) dos ultimos 30 dias, pra nao sumir do quadro assim que fecha.
    const includeTerminalSinceIso = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const items = await commercialOpportunityRepository.listAll({ includeTerminalSinceIso });
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar oportunidades comerciais", err);
    res.status(500).json({ error: "Erro ao listar oportunidades comerciais." });
  }
}

export async function getOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const opportunity = await commercialOpportunityRepository.findById(req.params.id);
    if (!opportunity) {
      res.status(404).json({ error: "Oportunidade nao encontrada." });
      return;
    }
    const events = await commercialEventRepository.findByOpportunityIds([opportunity.id]);
    res.json({ opportunity, events });
  } catch (err) {
    logger.error(SCOPE, "Erro ao buscar oportunidade comercial", err);
    res.status(500).json({ error: "Erro ao buscar oportunidade comercial." });
  }
}

export async function moveStage(req: Request, res: Response): Promise<void> {
  try {
    const { stage } = req.body;
    if (!VALID_STAGES.includes(stage)) {
      res.status(400).json({ error: "stage invalido." });
      return;
    }
    logger.info(SCOPE, "Movendo oportunidade manualmente", { staffId: req.staff?.id, id: req.params.id, stage });
    await commercialEngine.moveStageManually(req.params.id, stage);
    res.json({ status: "ok" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao mover oportunidade", err);
    res.status(500).json({ error: "Erro ao mover oportunidade." });
  }
}

export async function pauseResume(req: Request, res: Response): Promise<void> {
  try {
    const { paused } = req.body;
    if (typeof paused !== "boolean") {
      res.status(400).json({ error: "paused deve ser boolean." });
      return;
    }
    logger.info(SCOPE, "Pausando/retomando automacao comercial", { staffId: req.staff?.id, id: req.params.id, paused });
    await commercialEngine.setPausedManually(req.params.id, paused);
    res.json({ status: "ok" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao pausar/retomar automacao comercial", err);
    res.status(500).json({ error: "Erro ao pausar/retomar automacao comercial." });
  }
}

export async function listEvents(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await commercialEventRepository.listRecent(limit);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar historico comercial", err);
    res.status(500).json({ error: "Erro ao listar historico comercial." });
  }
}
