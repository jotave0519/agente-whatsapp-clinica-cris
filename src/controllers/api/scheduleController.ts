import { Request, Response } from "express";
import * as scheduleEventRepository from "../../repositories/scheduleEventRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import * as clinicCancellationService from "../../services/clinicCancellationService";
import * as postAttendanceEngine from "../../services/postAttendanceEngine";
import * as schedulingService from "../../services/schedulingService";
import { getOrCreateUserByPhone } from "../../services/userService";
import { AppError } from "../../utils/appError";
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
    const { userId, newPatient, procedure, start, durationMinutes, notes, staffId } = req.body;
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
      staffId,
    });
    res.status(201).json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar agendamento", err);
    if (err instanceof AppError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Erro ao criar agendamento." });
  }
}

// Remarcar consultas NAO e mais uma funcao do CRM: toda mudanca de data
// acontece pela conversa com o paciente no WhatsApp (garante que ele escolha
// um horario em que pode comparecer). O endpoint de remarcacao foi removido
// de proposito - src/conversation/steps/rescheduling.ts continua usando
// schedulingService.rescheduleAppointment() diretamente para o fluxo da IA.

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
  } catch (err) {
    logger.error(SCOPE, "Erro ao cancelar agendamento", err);
    if (err instanceof AppError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Erro ao cancelar agendamento." });
  }
}

/** Marcacao manual pela recepcao (consulta ja passou) - "Realizado" ou "Faltou" nao sao detectados automaticamente. */
export async function updateOutcome(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { outcome, staffId } = req.body;
    if (outcome !== "completed" && outcome !== "no_show") {
      res.status(400).json({ error: "outcome deve ser 'completed' ou 'no_show'." });
      return;
    }

    const status: "Concluido" | "Faltou" = outcome === "completed" ? "Concluido" : "Faltou";
    logger.info(SCOPE, "Marcando desfecho do agendamento via CRM", { staffId: req.staff?.id, scheduleId: id, outcome });
    let schedule = await scheduleRepository.updateScheduleStatus(id, status);
    if (staffId !== undefined) schedule = await scheduleRepository.updateStaff(id, staffId);
    await scheduleEventRepository.record(id, outcome === "completed" ? "completed" : "no_show");

    res.json(schedule);

    // Nao bloqueia a resposta ao CRM (mesmo padrao de cancelSchedule): o
    // desfecho ja foi marcado com sucesso, uma falha ao matricular no
    // pos-atendimento nunca deve aparecer como erro dessa acao para a equipe.
    if (outcome === "completed") {
      try {
        await postAttendanceEngine.enrollSchedule(schedule, "manual");
      } catch (enrollErr) {
        logger.error(SCOPE, "Falha ao matricular pos-atendimento (desfecho ja registrado com sucesso)", enrollErr);
      }
    }
  } catch (err) {
    logger.error(SCOPE, "Erro ao marcar desfecho do agendamento", err);
    res.status(500).json({ error: "Erro ao marcar desfecho do agendamento." });
  }
}

/** Usado pela Ficha do Paciente para atribuir/corrigir o profissional responsavel por um agendamento/procedimento. */
export async function updateScheduleStaff(req: Request, res: Response): Promise<void> {
  try {
    const { staffId } = req.body;
    const schedule = await scheduleRepository.updateStaff(req.params.id, staffId ?? null);
    res.json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar profissional responsavel", err);
    res.status(500).json({ error: "Erro ao atualizar profissional responsavel." });
  }
}
