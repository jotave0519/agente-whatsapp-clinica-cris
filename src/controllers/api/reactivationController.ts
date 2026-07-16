import { Request, Response } from "express";
import * as reactivationEventRepository from "../../repositories/reactivationEventRepository";
import * as reactivationRepository from "../../repositories/reactivationRepository";
import { ReactivationTargetStatus } from "../../types";
import { logger } from "../../utils/logger";

const SCOPE = "api.reactivation";

export async function listCampaigns(_req: Request, res: Response): Promise<void> {
  try {
    const items = await reactivationRepository.listCampaigns();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar campanhas de reativacao", err);
    res.status(500).json({ error: "Erro ao listar campanhas de reativacao." });
  }
}

export async function createCampaign(req: Request, res: Response): Promise<void> {
  try {
    const { name, segment_type, inactive_days } = req.body;
    if (!name || !segment_type || !inactive_days) {
      res.status(400).json({ error: "name, segment_type e inactive_days sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Criando campanha de reativacao", { staffId: req.staff?.id, name, segment_type });
    const campaign = await reactivationRepository.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar campanha de reativacao", err);
    res.status(500).json({ error: "Erro ao criar campanha de reativacao." });
  }
}

export async function updateCampaign(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Atualizando campanha de reativacao", { staffId: req.staff?.id, id: req.params.id });
    const campaign = await reactivationRepository.updateCampaign(req.params.id, req.body);
    res.json(campaign);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar campanha de reativacao", err);
    res.status(500).json({ error: "Erro ao atualizar campanha de reativacao." });
  }
}

export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Excluindo campanha de reativacao", { staffId: req.staff?.id, id: req.params.id });
    await reactivationRepository.deleteCampaign(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir campanha de reativacao", err);
    res.status(500).json({ error: "Erro ao excluir campanha de reativacao." });
  }
}

/** Duplicata nasce pausada (active=false) de proposito - evita 2 campanhas identicas rodando ao mesmo tempo sem revisao deliberada. */
export async function duplicateCampaign(req: Request, res: Response): Promise<void> {
  try {
    const original = await reactivationRepository.findCampaignById(req.params.id);
    if (!original) {
      res.status(404).json({ error: "Campanha nao encontrada." });
      return;
    }

    const { id, created_at, updated_at, ...rest } = original;
    logger.info(SCOPE, "Duplicando campanha de reativacao", { staffId: req.staff?.id, originalId: id });
    const copy = await reactivationRepository.createCampaign({ ...rest, name: `${rest.name} (cópia)`, active: false });
    res.status(201).json(copy);
  } catch (err) {
    logger.error(SCOPE, "Erro ao duplicar campanha de reativacao", err);
    res.status(500).json({ error: "Erro ao duplicar campanha de reativacao." });
  }
}

export async function getCampaignStats(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await reactivationRepository.findCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "Campanha nao encontrada." });
      return;
    }

    const targets = await reactivationRepository.listTargetsByCampaign(req.params.id);
    const byStatus: Record<ReactivationTargetStatus, number> = {
      pending: 0,
      awaiting_response: 0,
      responded: 0,
      ignored: 0,
      converted: 0,
      declined: 0,
      excluded: 0,
      failed: 0,
    };
    for (const t of targets) byStatus[t.status] += 1;

    const events = await reactivationEventRepository.findByTargetIds(targets.map((t) => t.id));

    res.json({ campaign, totalTargets: targets.length, byStatus, events });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar estatisticas da campanha", err);
    res.status(500).json({ error: "Erro ao carregar estatisticas da campanha." });
  }
}
