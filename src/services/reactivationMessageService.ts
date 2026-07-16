import { env } from "../config/env";
import { createMessage } from "../integrations/anthropicClient";
import { logger } from "../utils/logger";

const SCOPE = "reactivationMessageService";
const MAX_LENGTH = 500;

const FORBIDDEN_PATTERNS = [/r\$/i, /\d+\s*(reais|real)\b/i, /garant/i, /\bcura\b/i, /resultado definitivo/i, /promet/i];

export interface PatientContext {
  firstName: string;
  lastProcedure: string | null;
  daysSinceLastVisit: number | null;
  totalVisits: number;
  lastVisitStatus: "Concluido" | "Cancelado" | "Faltou" | null;
  messageStyle: string;
}

function isValid(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (text.length > MAX_LENGTH) return false;
  if (text.includes("{{") || text.includes("}}")) return false;
  return !FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

function buildPrompt(ctx: PatientContext): string {
  const facts = [
    `nome: ${ctx.firstName}`,
    ctx.lastProcedure ? `procedimento mais recente: ${ctx.lastProcedure}` : null,
    ctx.daysSinceLastVisit != null ? `dias desde a ultima visita: ${ctx.daysSinceLastVisit}` : null,
    `total de visitas: ${ctx.totalVisits}`,
    ctx.lastVisitStatus ? `status da ultima visita: ${ctx.lastVisitStatus}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return (
    "Voce e a recepcionista de uma clinica de estetica, escrevendo uma mensagem de WhatsApp para retomar contato com " +
    "uma paciente que nao volta ha um tempo. Objetivo: retomar o relacionamento, NAO vender - convide para uma nova " +
    "avaliacao ou procedimento de forma acolhedora, sem parecer uma campanha automatica.\n\n" +
    `Tom pedido: ${ctx.messageStyle}\n\n` +
    `Fatos reais sobre essa paciente (use APENAS o que estiver aqui, nada alem disso): ${facts}\n\n` +
    "REGRAS OBRIGATORIAS:\n" +
    "- Mensagem curta (2 a 4 frases), em portugues do Brasil, tom natural de WhatsApp.\n" +
    "- PROIBIDO mencionar preco, valores, promocoes ou qualquer numero em reais.\n" +
    "- PROIBIDO prometer resultado, cura, ou garantir qualquer efeito do procedimento.\n" +
    "- PROIBIDO inventar qualquer fato sobre a paciente que nao esteja listado acima.\n" +
    "- Se nao houver procedimento anterior conhecido, nao mencione nenhum procedimento especifico.\n" +
    "- Escreva o texto FINAL, pronto para enviar - nunca use {{placeholders}}.\n" +
    "- Responda APENAS com o texto da mensagem, sem aspas, sem explicacoes, sem markdown."
  );
}

/**
 * Compoe a mensagem inicial de reativacao usando a Claude, com base em fatos
 * estruturados do paciente (nunca linhas cruas do banco) - e o que permite
 * personalizacao real ("ja faz uns meses desde seu Botox") sem reimplementar
 * um gerador de linguagem em codigo. Retorna null se falhar/nao passar na
 * validacao apos 2 tentativas - o chamador trata isso como falha transitoria
 * (nunca cai silenciosamente num texto generico).
 */
export async function composeReactivationMessage(ctx: PatientContext): Promise<string | null> {
  const prompt = buildPrompt(ctx);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await createMessage({
        model: env.anthropicModel,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      if (isValid(text)) return text;
      logger.warn(SCOPE, "Mensagem gerada nao passou na validacao, tentando de novo", { attempt, text });
    } catch (err) {
      logger.error(SCOPE, "Falha ao chamar Claude para compor mensagem de reativacao", err);
    }
  }

  return null;
}
