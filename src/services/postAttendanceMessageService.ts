import { env } from "../config/env";
import { createMessage } from "../integrations/anthropicClient";
import { PostAttendanceFlowMessageType } from "../types";
import { logger } from "../utils/logger";

const SCOPE = "postAttendanceMessageService";
const MAX_LENGTH = 500;

// Alem das proibicoes ja usadas na reativacao, aqui e essencial proibir URL:
// so o tipo 'review' deve ter link, e ele e sempre anexado literalmente pelo
// codigo (nunca gerado pela IA) - evita a Claude "ajudar" inserindo um link
// alucinado em mensagens simple/question/reminder.
const FORBIDDEN_PATTERNS = [/r\$/i, /\d+\s*(reais|real)\b/i, /garant/i, /\bcura\b/i, /resultado definitivo/i, /promet/i, /https?:\/\//i];

export interface FollowUpContext {
  firstName: string;
  procedure: string;
  visitDate: string; // dd/mm/aaaa, ja formatada
  daysSinceVisit: number;
  totalVisits: number;
  messageType: PostAttendanceFlowMessageType;
  styleInstruction: string; // instrucao de estilo definida pela clinica pra esse passo do fluxo
}

function isValid(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (text.length > MAX_LENGTH) return false;
  if (text.includes("{{") || text.includes("}}")) return false;
  return !FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

const TYPE_GUIDANCE: Record<PostAttendanceFlowMessageType, string> = {
  simple: "Uma mensagem simples de acompanhamento, sem exigir resposta - so mostrando que a clinica se importa.",
  question: "Uma pergunta aberta e genuina sobre como o paciente esta se sentindo apos o procedimento, convidando a responder.",
  review: "Uma mensagem curta agradecendo a confianca e convidando o paciente a deixar uma avaliacao no Google (NAO inclua nenhum link - ele sera adicionado automaticamente depois do seu texto).",
  reminder: "Uma mensagem lembrando, de forma leve, que pode ser um bom momento para agendar um retorno - sem pressionar.",
};

function buildPrompt(ctx: FollowUpContext): string {
  const facts = [
    `nome: ${ctx.firstName}`,
    `procedimento realizado: ${ctx.procedure}`,
    `data do procedimento: ${ctx.visitDate}`,
    `dias desde o procedimento: ${ctx.daysSinceVisit}`,
    `total de visitas anteriores a esta clinica: ${ctx.totalVisits}`,
  ].join("; ");

  return (
    "Voce e a recepcionista de uma clinica de estetica, escrevendo uma mensagem de WhatsApp de acompanhamento pos-" +
    "procedimento para um paciente. Objetivo desta mensagem: " +
    `${TYPE_GUIDANCE[ctx.messageType]}\n\n` +
    `Instrucao de tom/estilo definida pela clinica para esta mensagem: ${ctx.styleInstruction}\n\n` +
    `Fatos reais sobre esse paciente (use APENAS o que estiver aqui, nada alem disso): ${facts}\n\n` +
    "REGRAS OBRIGATORIAS:\n" +
    "- Mensagem curta (2 a 4 frases), em portugues do Brasil, tom natural e humano de WhatsApp - nunca generica ou robotica.\n" +
    "- PROIBIDO mencionar preco, valores, promocoes ou qualquer numero em reais.\n" +
    "- PROIBIDO prometer resultado, cura, ou garantir qualquer efeito do procedimento.\n" +
    "- PROIBIDO fazer qualquer pergunta ou afirmacao de natureza clinica/diagnostica - voce nao e profissional de saude.\n" +
    "- PROIBIDO inventar qualquer fato sobre o paciente que nao esteja listado acima.\n" +
    "- PROIBIDO incluir links ou URLs no texto.\n" +
    "- Escreva o texto FINAL, pronto para enviar - nunca use {{placeholders}}.\n" +
    "- Responda APENAS com o texto da mensagem, sem aspas, sem explicacoes, sem markdown."
  );
}

/**
 * Compoe uma mensagem de pos-atendimento usando a Claude, com base em fatos
 * estruturados do paciente. Retorna null se falhar/nao passar na validacao
 * apos 2 tentativas - o chamador trata isso como falha transitoria (nunca cai
 * silenciosamente num texto generico).
 */
export async function composeFollowUpMessage(ctx: FollowUpContext): Promise<string | null> {
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
      logger.error(SCOPE, "Falha ao chamar Claude para compor mensagem de pos-atendimento", err);
    }
  }

  return null;
}
