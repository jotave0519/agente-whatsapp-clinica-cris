import axios from "axios";
import { env } from "../config/env";
import { IncomingWhatsAppMessage } from "../types";

function requireConfig() {
  const missing = [
    ["EVOLUTION_API_URL", env.evolutionApiUrl],
    ["EVOLUTION_API_KEY", env.evolutionApiKey],
    ["EVOLUTION_INSTANCE_NAME", env.evolutionInstanceName],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Variaveis de ambiente ausentes: ${missing.map(([name]) => name).join(", ")}`
    );
  }
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  requireConfig();
  const url = `${env.evolutionApiUrl.replace(/\/$/, "")}/message/sendText/${env.evolutionInstanceName}`;

  await axios.post(
    url,
    { number: to, text },
    { headers: { apikey: env.evolutionApiKey, "Content-Type": "application/json" }, timeout: 30000 }
  );
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
