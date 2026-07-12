import { Request, Response } from "express";

/** Retorna o registro de staff do usuario autenticado (ja resolvido pelo requireAuth) - usado pelo CRM web para saber o perfil (role) e ajustar a navegacao. */
export function getMe(req: Request, res: Response): void {
  res.json(req.staff);
}
