import { Request, Response } from "express";
import { getSupabaseClient } from "../../integrations/supabaseClient";
import * as staffRepository from "../../repositories/staffRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.staff";

export async function listStaff(_req: Request, res: Response): Promise<void> {
  try {
    const staff = await staffRepository.listAll();
    const items = await Promise.all(
      staff.map(async (s) => {
        let lastSignInAt: string | null = null;
        try {
          const { data } = await getSupabaseClient().auth.admin.getUserById(s.id);
          lastSignInAt = data.user?.last_sign_in_at ?? null;
        } catch (err) {
          logger.warn(SCOPE, "Falha ao buscar last_sign_in_at", { staffId: s.id, error: (err as Error).message });
        }
        return { ...s, last_sign_in_at: lastSignInAt };
      })
    );
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar staff", err);
    res.status(500).json({ error: "Erro ao listar usuarios." });
  }
}

export async function createStaff(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email e password sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Criando staff via CRM", { adminId: req.staff?.id, email, role });
    const { data, error } = await getSupabaseClient().auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      logger.error(SCOPE, "Erro ao criar usuario no Supabase Auth", error);
      res.status(400).json({ error: "Nao foi possivel criar o usuario. Verifique os dados informados." });
      return;
    }

    const staff = await staffRepository.create(data.user.id, name, email, role || "recepcionista");
    res.status(201).json(staff);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar staff", err);
    res.status(500).json({ error: "Erro ao criar usuario." });
  }
}

export async function deleteStaff(req: Request, res: Response): Promise<void> {
  try {
    if (req.params.id === req.staff?.id) {
      res.status(400).json({ error: "Nao e possivel excluir sua propria conta." });
      return;
    }

    logger.info(SCOPE, "Excluindo staff via CRM", { adminId: req.staff?.id, targetId: req.params.id });
    const { error } = await getSupabaseClient().auth.admin.deleteUser(req.params.id);
    if (error) {
      logger.error(SCOPE, "Erro ao excluir usuario no Supabase Auth", error);
      res.status(400).json({ error: "Nao foi possivel excluir o usuario." });
      return;
    }
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir staff", err);
    res.status(500).json({ error: "Erro ao excluir usuario." });
  }
}

export async function updateStaff(req: Request, res: Response): Promise<void> {
  try {
    const { role, active } = req.body;

    if (req.params.id === req.staff?.id && (role !== undefined || active === false)) {
      res.status(400).json({ error: "Nao e possivel alterar sua propria role ou desativar sua propria conta." });
      return;
    }

    logger.info(SCOPE, "Atualizando staff via CRM", { adminId: req.staff?.id, targetId: req.params.id, role, active });
    const staff = await staffRepository.update(req.params.id, { role, active });
    res.json(staff);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar staff", err);
    res.status(500).json({ error: "Erro ao atualizar usuario." });
  }
}
