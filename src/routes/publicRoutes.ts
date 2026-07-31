import { Router } from "express";
import { getPublicQrCode, getPublicStatus } from "../controllers/api/whatsappController";

/**
 * Rotas sem autenticacao (token efemero na URL faz esse papel) - usadas
 * pela pagina standalone de conexao do WhatsApp por link, aberta em outro
 * aparelho sem login no CRM.
 */
export const publicRouter = Router();

publicRouter.get("/whatsapp/connect-link/:token/qrcode", getPublicQrCode);
publicRouter.get("/whatsapp/connect-link/:token/status", getPublicStatus);
