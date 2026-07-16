import { Request, Response } from "express";
import * as googleCalendar from "../../integrations/googleCalendarClient";
import * as scheduleEventRepository from "../../repositories/scheduleEventRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.patient";

export async function listPatients(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await userRepository.listAll({ search, limit, offset });
    res.json(result);
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar pacientes", err);
    res.status(500).json({ error: "Erro ao listar pacientes." });
  }
}

export async function getPatient(req: Request, res: Response): Promise<void> {
  try {
    const patient = await userRepository.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }
    res.json(patient);
  } catch (err) {
    logger.error(SCOPE, "Erro ao buscar paciente", err);
    res.status(500).json({ error: "Erro ao buscar paciente." });
  }
}

/** Usado pela pagina de detalhe do paciente no CRM: agendamentos + linha do tempo de eventos (schedule_events). */
export async function getPatientHistory(req: Request, res: Response): Promise<void> {
  try {
    const patient = await userRepository.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }

    const [schedules, events] = await Promise.all([
      scheduleRepository.findAllByUserId(patient.id),
      scheduleEventRepository.findByUserId(patient.id),
    ]);

    res.json({ patient, schedules, events });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar historico do paciente", err);
    res.status(500).json({ error: "Erro ao carregar historico do paciente." });
  }
}

export async function createPatient(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone) {
      res.status(400).json({ error: "name e phone sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Criando paciente via CRM", { staffId: req.staff?.id, name });
    const patient = await userRepository.createPatient({ name, phone, email });
    res.status(201).json(patient);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar paciente", err);
    res.status(500).json({ error: "Erro ao criar paciente." });
  }
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, email, active } = req.body;
    logger.info(SCOPE, "Atualizando paciente via CRM", { staffId: req.staff?.id, id: req.params.id });
    const patient = await userRepository.updatePatient(req.params.id, { name, phone, email, active });
    res.json(patient);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar paciente", err);
    res.status(500).json({ error: "Erro ao atualizar paciente." });
  }
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  try {
    const patient = await userRepository.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Paciente nao encontrado." });
      return;
    }

    const activeSchedules = await scheduleRepository.findActiveSchedulesByUser(patient.id);
    for (const schedule of activeSchedules) {
      if (!schedule.google_event_id) continue;
      try {
        await googleCalendar.cancelEvent(schedule.google_event_id);
      } catch (err) {
        logger.warn(SCOPE, "Falha ao cancelar evento no Google Calendar (seguindo com a exclusao)", {
          scheduleId: schedule.id,
          error: (err as Error).message,
        });
      }
    }

    logger.info(SCOPE, "Excluindo paciente via CRM", { staffId: req.staff?.id, id: patient.id, activeSchedules: activeSchedules.length });
    await userRepository.deleteUser(patient.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir paciente", err);
    res.status(500).json({ error: "Erro ao excluir paciente." });
  }
}
