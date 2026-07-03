import axios from "axios";
import { env } from "../config/env";
import { IncomingWhatsAppMessage } from "../types";
import { logger } from "../utils/logger";

const SCOPE = "evolutionApiClient";

function requireConfig() {
  const missing = [
    ["EVOLUTION_API_URL", env.evolutionApiUrl],
    ["EVOLUTION_API_KEY", env.evolutionApiKey],
    ["EVOLUTION_INSTANCE_NAME", env.evolutionInstanceName],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    const message = `Variaveis de ambiente ausentes: ${missing.map(([name]) => name).join(", ")}`;
    logger.error(SCOPE, message);
    throw new Error(message);
  }
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  requireConfig();
  const url = `${env.evolutionApiUrl.replace(/\/$/, "")}/message/sendText/${env.evolutionInstanceName}`;
  logger.info(SCOPE, "Enviando mensagem via Evolution API", { to, url });

  try {
    await axios.post(
      url,
      { number: to, text },
      { headers: { apikey: env.evolutionApiKey, "Content-Type": "application/json" }, timeout: 30000 }
    );
    logger.info(SCOPE, "Mensagem enviada com sucesso", { to });
  } catch (err) {
    logger.error(SCOPE, `Falha ao enviar mensagem para ${to}`, err);
    throw err;
  }
}

export interface InstanceInfo {
  connectionStatus: string;
  ownerJid: string | null;
  profileName: string | null;
  createdAt: string | null;
  messageCount: number;
  contactCount: number;
  chatCount: number;
}

/** Status/estatisticas reais da instancia - usado pela tela WhatsApp do CRM. */
export async function getInstanceInfo(): Promise<InstanceInfo> {
  requireConfig();
  const url = `${env.evolutionApiUrl.replace(/\/$/, "")}/instance/fetchInstances`;

  try {
    const response = await axios.get(url, {
      headers: { apikey: env.evolutionApiKey },
      params: { instanceName: env.evolutionInstanceName },
      timeout: 15000,
    });
    const instance = Array.isArray(response.data) ? response.data[0] : response.data;
    return {
      connectionStatus: instance?.connectionStatus || "unknown",
      ownerJid: instance?.ownerJid || null,
      profileName: instance?.profileName || null,
      createdAt: instance?.createdAt || null,
      messageCount: instance?._count?.Message ?? 0,
      contactCount: instance?._count?.Contact ?? 0,
      chatCount: instance?._count?.Chat ?? 0,
    };
  } catch (err) {
    logger.error(SCOPE, "Falha ao buscar status da instancia", err);
    throw err;
  }
}

/**
 * QR code para vincular/reconectar o dispositivo. So gera um pareamento novo
 * se a instancia estiver desconectada - com a instancia ja conectada, a
 * Evolution API retorna apenas o estado atual, sem efeito colateral.
 */
export async function getConnectQrCode(): Promise<{ base64: string | null; pairingCode: string | null }> {
  requireConfig();
  const url = `${env.evolutionApiUrl.replace(/\/$/, "")}/instance/connect/${env.evolutionInstanceName}`;

  try {
    const response = await axios.get(url, { headers: { apikey: env.evolutionApiKey }, timeout: 15000 });
    return {
      base64: response.data?.base64 || response.data?.qrcode?.base64 || null,
      pairingCode: response.data?.pairingCode || null,
    };
  } catch (err) {
    logger.error(SCOPE, "Falha ao gerar QR code de conexao", err);
    throw err;
  }
}

/** Desvincula o dispositivo atual (acao destrutiva - interrompe o atendimento via WhatsApp). */
export async function disconnectInstance(): Promise<void> {
  requireConfig();
  const url = `${env.evolutionApiUrl.replace(/\/$/, "")}/instance/logout/${env.evolutionInstanceName}`;

  try {
    await axios.delete(url, { headers: { apikey: env.evolutionApiKey }, timeout: 15000 });
    logger.info(SCOPE, "Instancia desconectada via CRM");
  } catch (err) {
    logger.error(SCOPE, "Falha ao desconectar instancia", err);
    throw err;
  }
}

/**
 * Extrai remetente e texto de um evento de webhook messages.upsert da Evolution API.
 * Retorna null se o evento nao for uma mensagem de texto recebida (ex: enviada por nos mesmos).
 */
export function parseIncomingWebhook(payload: any): IncomingWhatsAppMessage | null {
  const data = payload?.data;
  if (!data) return null;

  const key = data.key || {};
  if (key.fromMe) return null;

  const message = data.message || {};
  const text: string | undefined = message.conversation || message.extendedTextMessage?.text;
  if (!text) return null;

  const remoteJid: string = key.remoteJid || "";
  const phone = remoteJid.includes("@") ? remoteJid.split("@")[0] : remoteJid;

  return { phone, text, pushName: data.pushName };
}
