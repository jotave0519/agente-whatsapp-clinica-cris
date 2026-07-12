import { NextFunction, Request, Response } from "express";
import { StaffRole } from "../types";

/**
 * Usado apos requireAuth, nas rotas restritas a um subconjunto de perfis
 * (ex: admin + recepcionista, mas nao profissional). Para rotas restritas
 * apenas a admin, prefira o requireAdmin ja existente.
 */
export function requireRole(...allowedRoles: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.staff || !allowedRoles.includes(req.staff.role)) {
      res.status(403).json({ error: "Voce nao tem permissao para acessar este recurso." });
      return;
    }
    next();
  };
}
