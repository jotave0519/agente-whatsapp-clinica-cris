import { NextFunction, Request, Response } from "express";

/**
 * Dominios pelos quais o CRM pode ser aberto. O app pode chamar a API pelo
 * dominio reserva (ver web/src/lib/api.ts) mesmo estando aberto no dominio
 * antigo - por isso a API precisa aceitar chamadas vindas de qualquer um deles.
 */
const ALLOWED_ORIGINS = new Set([
  "https://clinca-cris-clinica-cris-app.uule1c.easypanel.host",
  "https://zangelmi.nortic.digital",
]);

/** CORS minimo para /api/v1 (sem dependencia nova). */
export function apiCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

/**
 * Uma linha de log por chamada da API: metodo, caminho (sem query string),
 * status, tempo e por qual dominio chegou. Nada de token, corpo ou dado de
 * paciente. Serve para saber se as chamadas do aparelho da clinica estao
 * chegando ao servidor (diagnostico de "Failed to fetch").
 */
export function apiRequestLog(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0];
    console.log(`[API] ${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms host=${req.headers.host}`);
  });
  next();
}
