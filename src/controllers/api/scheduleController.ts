import { Request, Response } from "express";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import * as schedulingService from "../../services/schedulingService";
import { logger } from "../../utils/logger";

const SCOPE = "api.schedule";

export async function listSchedules(req: Request, res: Response): Promise<void> {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) {
      res.status(400).json({ error: "Parametros 'from' e 'to' (YYYY-MM-DD) sao obrigatorios." });
      return;
    }

    const schedules = await scheduleRepository.findByDateRange(from, to);
    res.json({ items: schedules });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar agendamentos", err);
    res.status(500).json({ error: "Erro ao listar agendamentos." });
  }
}

export async function createSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { userId, procedure, start, durationMinutes } = req.body;
    if (!userId || !procedure || !start) {
      res.status(400).json({ error: "userId, procedure e start sao obrigatorios." });
      return;
    }

    const patient = await userRepository.findById(userId);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }

    logger.info(SCOPE, "Criando agendamento via CRM", { staffId: req.staff?.id, userId, procedure, start });
    const schedule = await schedulingService.createAppointment({
      userId: patient.id,
      name: patient.name,
      phone: patient.phone,
      service: procedure,
      start,
      durationMinutes,
    });
    res.status(201).json(schedule);
  } catch (err: any) {
    logger.error(SCOPE, "Erro ao criar agendamento", err);
    res.status(500).json({ error: `Erro ao criar agendamento: ${err.message}` });
  }
}

export async function rescheduleSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { start, durationMinutes } = req.body;
    if (!start) {
      res.status(400).json({ error: "start e obrigatorio." });
      return;
    }

    logger.info(SCOPE, "Remarcando agendamento via CRM", { staffId: req.staff?.id, scheduleId: id, start });
    const schedule = await schedulingService.rescheduleAppointment(id, start, durationMinutes);
    res.json(schedule);
  } catch (err: any) {
    logger.error(SCOPE, "Erro ao remarcar agendamento", err);
    res.status(500).json({ error: `Erro ao remarcar agendamento: ${err.message}` });
  }
}

export async function cancelSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    logger.info(SCOPE, "Cancelando agendamento via CRM", { staffId: req.staff?.id, scheduleId: id });
    const schedule = await schedulingService.cancelAppointment(id);
    res.json(schedule);
  } catch (err: any) {
    logger.error(SCOPE, "Erro ao cancelar agendamento", err);
    res.status(500).json({ error: `Erro ao cancelar agendamento: ${err.message}` });
  }
}
