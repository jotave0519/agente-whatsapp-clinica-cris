import { NextFunction, Request, Response } from "express";

/** Usado apos requireAuth, nas rotas restritas ao papel "admin" (ex: gestao de usuarios). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.staff?.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores." });
    return;
  }
  next();
}
