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
