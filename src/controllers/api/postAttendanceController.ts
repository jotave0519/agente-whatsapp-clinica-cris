import { Request, Response } from "express";
import * as postAttendanceRepository from "../../repositories/postAttendanceRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.postAttendance";

export async function listFlows(_req: Request, res: Response): Promise<void> {
  try {
    const flows = await postAttendanceRepository.listFlows();
    const messages = await postAttendanceRepository.listFlowMessagesByFlowIds(flows.map((f) => f.id));
    const items = flows.map((flow) => ({ ...flow, messages: messages.filter((m) => m.flow_id === flow.id) }));
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar fluxos de pos-atendimento", err);
    res.status(500).json({ error: "Erro ao listar fluxos de pos-atendimento." });
  }
}

export async function createFlow(req: Request, res: Response): Promise<void> {
  try {
    const { name, procedure_match, active, messages } = req.body;
    if (!name || !procedure_match) {
      res.status(400).json({ error: "name e procedure_match sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Criando fluxo de pos-atendimento", { staffId: req.staff?.id, name, procedure_match });
    const flow = await postAttendanceRepository.createFlow({ name, procedure_match, active });
    if (Array.isArray(messages) && messages.length > 0) {
      await postAttendanceRepository.replaceFlowMessages(flow.id, messages);
    }
    const savedMessages = await postAttendanceRepository.listFlowMessages(flow.id);
    res.status(201).json({ ...flow, messages: savedMessages });
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar fluxo de pos-atendimento", err);
    res.status(500).json({ error: "Erro ao criar fluxo de pos-atendimento." });
  }
}

export async function updateFlow(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, procedure_match, active, messages } = req.body;

    logger.info(SCOPE, "Atualizando fluxo de pos-atendimento", { staffId: req.staff?.id, id });
    const flow = await postAttendanceRepository.updateFlow(id, { name, procedure_match, active });
    if (Array.isArray(messages)) {
      await postAttendanceRepository.replaceFlowMessages(id, messages);
    }
    const savedMessages = await postAttendanceRepository.listFlowMessages(id);
    res.json({ ...flow, messages: savedMessages });
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar fluxo de pos-atendimento", err);
    res.status(500).json({ error: "Erro ao atualizar fluxo de pos-atendimento." });
  }
}

export async function deleteFlow(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Excluindo fluxo de pos-atendimento", { staffId: req.staff?.id, id: req.params.id });
    await postAttendanceRepository.deleteFlow(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir fluxo de pos-atendimento", err);
    res.status(500).json({ error: "Erro ao excluir fluxo de pos-atendimento." });
  }
}

export async function listEnrollments(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const status = (req.query.status as string) || undefined;
    const result = await postAttendanceRepository.listEnrollments({ limit, offset, status: status as any });
    res.json(result);
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar historico de pos-atendimento", err);
    res.status(500).json({ error: "Erro ao listar historico de pos-atendimento." });
  }
}
