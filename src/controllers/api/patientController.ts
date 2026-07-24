import { Request, Response } from "express";
import * as googleCalendar from "../../integrations/googleCalendarClient";
import { getSupabaseClient } from "../../integrations/supabaseClient";
import * as patientDocumentRepository from "../../repositories/patientDocumentRepository";
import * as patientGoalRepository from "../../repositories/patientGoalRepository";
import * as patientMediaRepository from "../../repositories/patientMediaRepository";
import * as patientNoteRepository from "../../repositories/patientNoteRepository";
import * as patientTimelineEventRepository from "../../repositories/patientTimelineEventRepository";
import * as procedureRepository from "../../repositories/procedureRepository";
import * as scheduleEventRepository from "../../repositories/scheduleEventRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as transactionRepository from "../../repositories/transactionRepository";
import * as userRepository from "../../repositories/userRepository";
import * as patientSummaryService from "../../services/patientSummaryService";
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
    const { name, phone, email, active, do_not_contact, photo_path } = req.body;
    logger.info(SCOPE, "Atualizando paciente via CRM", { staffId: req.staff?.id, id: req.params.id });
    const patient = await userRepository.updatePatient(req.params.id, { name, phone, email, active, do_not_contact, photo_path });
    res.json(patient);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar paciente", err);
    res.status(500).json({ error: "Erro ao atualizar paciente." });
  }
}

/** Indicadores rapidos (primeira/ultima consulta, total investido, procedimento mais realizado, etc) - usado pelo header da Ficha do Paciente. */
export async function getPatientSummary(req: Request, res: Response): Promise<void> {
  try {
    const summary = await patientSummaryService.getSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    logger.error(SCOPE, "Erro ao calcular resumo do paciente", err);
    res.status(500).json({ error: "Erro ao calcular resumo do paciente." });
  }
}

/**
 * Pagamentos (receitas) vinculados ao paciente - mesma tabela `transactions`
 * usada pelo Financeiro (transactionRepository.findByUserId), unica fonte de
 * dados. Edicao/exclusao usam os endpoints genericos /finance/transactions/:id
 * ja existentes, entao qualquer alteracao aqui aparece automaticamente no
 * Financeiro e vice-versa - nao ha replicacao/sincronizacao manual.
 */
export async function listPatientTransactions(req: Request, res: Response): Promise<void> {
  try {
    const [transactions, procedures] = await Promise.all([transactionRepository.findByUserId(req.params.id), procedureRepository.listAll()]);
    const procedureNameById = new Map(procedures.map((p) => [p.id, p.name]));
    const items = transactions
      .filter((t) => t.type === "receita")
      .map((t) => ({ ...t, procedureName: t.procedure_id ? procedureNameById.get(t.procedure_id) || null : null }));
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar pagamentos do paciente", err);
    res.status(500).json({ error: "Erro ao listar pagamentos do paciente." });
  }
}

/** Sugestoes de retorno baseadas em procedures.recommended_interval_days - usado na aba Visao Geral da Ficha. */
export async function getPatientSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const items = await patientSummaryService.getSuggestions(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao calcular sugestoes de retorno", err);
    res.status(500).json({ error: "Erro ao calcular sugestoes de retorno." });
  }
}

/** Timeline agregada (schedule_events + pagamentos + notas + objetivos + midia + documentos + eventos manuais) - usado na aba Visao Geral da Ficha. */
export async function getPatientTimeline(req: Request, res: Response): Promise<void> {
  try {
    const items = await patientSummaryService.getTimeline(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar timeline do paciente", err);
    res.status(500).json({ error: "Erro ao carregar timeline do paciente." });
  }
}

export async function listPatientNotes(req: Request, res: Response): Promise<void> {
  try {
    const items = await patientNoteRepository.findByUserId(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar observacoes clinicas", err);
    res.status(500).json({ error: "Erro ao listar observacoes clinicas." });
  }
}

export async function createPatientNote(req: Request, res: Response): Promise<void> {
  try {
    const { body } = req.body;
    if (!body) {
      res.status(400).json({ error: "body e obrigatorio." });
      return;
    }
    const note = await patientNoteRepository.create(req.params.id, body, req.staff?.id ?? null);
    res.status(201).json(note);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar observacao clinica", err);
    res.status(500).json({ error: "Erro ao criar observacao clinica." });
  }
}

export async function deletePatientNote(req: Request, res: Response): Promise<void> {
  try {
    await patientNoteRepository.remove(req.params.noteId);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir observacao clinica", err);
    res.status(500).json({ error: "Erro ao excluir observacao clinica." });
  }
}

export async function listPatientGoals(req: Request, res: Response): Promise<void> {
  try {
    const items = await patientGoalRepository.findByUserId(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar objetivos", err);
    res.status(500).json({ error: "Erro ao listar objetivos." });
  }
}

export async function createPatientGoal(req: Request, res: Response): Promise<void> {
  try {
    const { description } = req.body;
    if (!description) {
      res.status(400).json({ error: "description e obrigatorio." });
      return;
    }
    const goal = await patientGoalRepository.create(req.params.id, description);
    res.status(201).json(goal);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar objetivo", err);
    res.status(500).json({ error: "Erro ao criar objetivo." });
  }
}

export async function updatePatientGoal(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (status !== "ativo" && status !== "concluido") {
      res.status(400).json({ error: "status deve ser 'ativo' ou 'concluido'." });
      return;
    }
    const goal = await patientGoalRepository.updateStatus(req.params.goalId, status);
    res.json(goal);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar objetivo", err);
    res.status(500).json({ error: "Erro ao atualizar objetivo." });
  }
}

export async function deletePatientGoal(req: Request, res: Response): Promise<void> {
  try {
    await patientGoalRepository.remove(req.params.goalId);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir objetivo", err);
    res.status(500).json({ error: "Erro ao excluir objetivo." });
  }
}

export async function listPatientMedia(req: Request, res: Response): Promise<void> {
  try {
    const items = await patientMediaRepository.findByUserId(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar fotos", err);
    res.status(500).json({ error: "Erro ao listar fotos." });
  }
}

/** Recebe so a metadata - o arquivo em si ja foi enviado pelo navegador direto ao Supabase Storage. */
export async function createPatientMedia(req: Request, res: Response): Promise<void> {
  try {
    const { scheduleId, kind, storagePath } = req.body;
    if (!kind || !storagePath || (kind !== "antes" && kind !== "depois")) {
      res.status(400).json({ error: "kind ('antes'|'depois') e storagePath sao obrigatorios." });
      return;
    }
    const media = await patientMediaRepository.create({ userId: req.params.id, scheduleId, kind, storagePath });
    res.status(201).json(media);
  } catch (err) {
    logger.error(SCOPE, "Erro ao registrar foto", err);
    res.status(500).json({ error: "Erro ao registrar foto." });
  }
}

export async function deletePatientMedia(req: Request, res: Response): Promise<void> {
  try {
    const media = await patientMediaRepository.findById(req.params.mediaId);
    if (media) {
      try {
        await getSupabaseClient().storage.from("patient-media").remove([media.storage_path]);
      } catch (storageErr) {
        logger.warn(SCOPE, "Falha ao remover arquivo do Storage (seguindo com a exclusao do registro)", { mediaId: req.params.mediaId, error: (storageErr as Error).message });
      }
    }
    await patientMediaRepository.remove(req.params.mediaId);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir foto", err);
    res.status(500).json({ error: "Erro ao excluir foto." });
  }
}

export async function listPatientDocuments(req: Request, res: Response): Promise<void> {
  try {
    const items = await patientDocumentRepository.findByUserId(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar documentos", err);
    res.status(500).json({ error: "Erro ao listar documentos." });
  }
}

export async function createPatientDocument(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, storagePath } = req.body;
    if (!name || !storagePath) {
      res.status(400).json({ error: "name e storagePath sao obrigatorios." });
      return;
    }
    const document = await patientDocumentRepository.create({ userId: req.params.id, name, category, storagePath });
    res.status(201).json(document);
  } catch (err) {
    logger.error(SCOPE, "Erro ao registrar documento", err);
    res.status(500).json({ error: "Erro ao registrar documento." });
  }
}

export async function deletePatientDocument(req: Request, res: Response): Promise<void> {
  try {
    const doc = await patientDocumentRepository.findById(req.params.docId);
    if (doc) {
      try {
        await getSupabaseClient().storage.from("patient-documents").remove([doc.storage_path]);
      } catch (storageErr) {
        logger.warn(SCOPE, "Falha ao remover arquivo do Storage (seguindo com a exclusao do registro)", { docId: req.params.docId, error: (storageErr as Error).message });
      }
    }
    await patientDocumentRepository.remove(req.params.docId);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir documento", err);
    res.status(500).json({ error: "Erro ao excluir documento." });
  }
}

export async function createPatientTimelineEvent(req: Request, res: Response): Promise<void> {
  try {
    const { title, detail, occurredAt } = req.body;
    if (!title) {
      res.status(400).json({ error: "title e obrigatorio." });
      return;
    }
    const event = await patientTimelineEventRepository.create({ userId: req.params.id, title, detail, occurredAt, createdBy: req.staff?.id ?? null });
    res.status(201).json(event);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar evento manual", err);
    res.status(500).json({ error: "Erro ao criar evento manual." });
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
