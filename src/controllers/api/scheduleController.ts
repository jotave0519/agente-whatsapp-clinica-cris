import { Request, Response } from "express";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import * as clinicCancellationService from "../../services/clinicCancellationService";
import * as schedulingService from "../../services/schedulingService";
import { getOrCreateUserByPhone } from "../../services/userService";
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
    const { userId, newPatient, procedure, start, durationMinutes, notes } = req.body;
    if ((!userId && !newPatient) || !procedure || !start) {
      res.status(400).json({ error: "userId (ou newPatient), procedure e start sao obrigatorios." });
      return;
    }

    let patient;
    if (userId) {
      patient = await userRepository.findById(userId);
      if (!patient) {
        res.status(404).json({ error: "Paciente nao encontrado." });
        return;
      }
    } else {
      if (!newPatient.name || !newPatient.phone) {
        res.status(400).json({ error: "newPatient.name e newPatient.phone sao obrigatorios." });
        return;
      }
      patient = await getOrCreateUserByPhone(newPatient.phone, newPatient.name);
    }

    logger.info(SCOPE, "Criando agendamento via CRM", { staffId: req.staff?.id, patientId: patient.id, procedure, start });
    const schedule = await schedulingService.createAppointment({
      userId: patient.id,
      name: patient.name,
      phone: patient.phone,
      service: procedure,
      start,
      durationMinutes,
      notes,
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
    const reason: string | undefined = req.body?.reason;
    logger.info(SCOPE, "Cancelando agendamento via CRM", { staffId: req.staff?.id, scheduleId: id, hasReason: !!reason });
    const schedule = await schedulingService.cancelAppointment(id);
    res.json(schedule);

    // Nao bloqueia a resposta ao CRM: o agendamento ja foi cancelado com
    // sucesso, uma falha ao notificar o cliente (ex: WhatsApp instavel) nao
    // deve aparecer como erro de cancelamento para a equipe.
    try {
      await clinicCancellationService.notifyAndOfferReschedule(schedule, reason);
    } catch (notifyErr) {
      logger.error(SCOPE, "Falha ao notificar cliente sobre cancelamento", notifyErr);
    }
  } catch (err: any) {
    logger.error(SCOPE, "Erro ao cancelar agendamento", err);
    res.status(500).json({ error: `Erro ao cancelar agendamento: ${err.message}` });
  }
}
