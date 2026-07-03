import { Request, Response } from "express";
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
