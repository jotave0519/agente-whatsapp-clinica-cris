import { env } from "../config/env";
import { createMessage } from "../integrations/anthropicClient";
import { CommercialSignalType } from "../types";
import { logger } from "../utils/logger";

const SCOPE = "commercialMessageService";
const MAX_LENGTH = 500;

// Mesmas proibicoes da reativacao/pos-atendimento, mais uma nova: gatilho de
// urgencia/escassez - e venda, mas tem que continuar soando como recepcionista
// que se lembra do paciente, nunca como campanha ("ultimas vagas", "so hoje").
const FORBIDDEN_PATTERNS = [
  /r\$/i,
  /\d+\s*(reais|real)\b/i,
  /garant/i,
  /\bcura\b/i,
  /resultado definitivo/i,
  /promet/i,
  /https?:\/\//i,
  /(ultima|ultimas|poucas)\s+vaga/i,
  /so hoje|apenas hoje|por tempo limitado/i,
];

export interface FollowUpContext {
  firstName: string;
  procedureInterest: string;
  sourceSignal: CommercialSignalType;
  signalNote: string | null; // citacao real do paciente, capturada no momento da deteccao
  daysSinceSignal: number;
  attemptNumber: number; // 1 = primeira mensagem, 2+ = tentativas seguintes
}

const SIGNAL_GUIDANCE: Record<CommercialSignalType, string> = {
  price_question: "O paciente perguntou sobre valores e nao voltou a falar. Retome de forma leve, sem falar de preco de novo, oferecendo tirar duvidas.",
  general_interest: "O paciente demonstrou interesse no procedimento mas nao avancou. Retome perguntando se ainda faz sentido para ele, sem pressionar.",
  abandoned_scheduling: "O paciente comecou a marcar um horario mas nao terminou. Retome perguntando se ele quer que voce ajude a concluir o agendamento.",
  post_evaluation_no_procedure: "O paciente fez uma avaliacao mas nao marcou o procedimento depois. Pergunte como ele esta e se ainda tem interesse, oferecendo verificar horarios.",
  will_think: "O paciente disse que ia pensar. Retome perguntando, com leveza, se ficou alguma duvida - sem cobrar uma resposta.",
  no_money: "O paciente comentou sobre o custo/dinheiro no momento. Retome sem tocar em valores, so mostrando que a porta continua aberta para quando fizer sentido para ele.",
  traveling: "O paciente disse que ia viajar. Retome com carinho, como quem pergunta como foi a viagem, e so depois oferece retomar o planejamento.",
  needs_to_talk: "O paciente disse que precisava conversar com alguem (parceiro, familia) antes de decidir. Retome perguntando se ainda tem interesse, sem pressionar por uma resposta.",
  come_back_later: "O paciente disse que resolveria isso depois. Retome de forma leve, perguntando se e um bom momento para conversar sobre o procedimento agora.",
  other: "O paciente demonstrou interesse num procedimento sem confirmar avancar. Retome de forma acolhedora e contextual.",
};

function isValid(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (text.length > MAX_LENGTH) return false;
  if (text.includes("{{") || text.includes("}}")) return false;
  return !FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

function buildPrompt(ctx: FollowUpContext): string {
  const facts = [
    `nome: ${ctx.firstName}`,
    `procedimento de interesse: ${ctx.procedureInterest}`,
    ctx.signalNote ? `o que o paciente disse na ocasiao (use isso para soar contextual, nao generico): "${ctx.signalNote}"` : null,
    `dias desde esse contato: ${ctx.daysSinceSignal}`,
    ctx.attemptNumber > 1 ? `esta e a tentativa numero ${ctx.attemptNumber} de acompanhamento (ja tentou antes sem resposta) - seja ainda mais breve e leve, nunca cobre uma resposta` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return (
    "Voce e a recepcionista de uma clinica de estetica, escrevendo uma mensagem de WhatsApp para retomar contato com um " +
    "paciente que demonstrou interesse num procedimento mas nao converteu ainda. Objetivo: reabrir a porta com leveza, " +
    "NUNCA insistir, NUNCA soar como cobranca ou campanha de vendas.\n\n" +
    `Contexto especifico desta mensagem: ${SIGNAL_GUIDANCE[ctx.sourceSignal]}\n\n` +
    `Fatos reais sobre esse paciente (use APENAS o que estiver aqui, nada alem disso): ${facts}\n\n` +
    "REGRAS OBRIGATORIAS:\n" +
    "- Mensagem curta (2 a 4 frases), em portugues do Brasil, tom natural e humano de WhatsApp - nunca generica.\n" +
    "- PROIBIDO mencionar preco, valores, promocoes ou qualquer numero em reais.\n" +
    "- PROIBIDO prometer resultado, cura, ou garantir qualquer efeito do procedimento.\n" +
    "- PROIBIDO usar gatilho de urgencia ou escassez (ex: 'ultimas vagas', 'só hoje', 'por tempo limitado').\n" +
    "- PROIBIDO soar como cobranca ('você ainda não decidiu?', 'estou esperando sua resposta').\n" +
    "- PROIBIDO inventar qualquer fato sobre o paciente que nao esteja listado acima.\n" +
    "- PROIBIDO incluir links ou URLs no texto.\n" +
    "- Escreva o texto FINAL, pronto para enviar - nunca use {{placeholders}}.\n" +
    "- Responda APENAS com o texto da mensagem, sem aspas, sem explicacoes, sem markdown."
  );
}

/**
 * Compoe uma mensagem de acompanhamento comercial usando a Claude, sempre
 * citando o contexto real capturado (signalNote) - nunca um texto generico.
 * Retorna null se falhar/nao passar na validacao apos 2 tentativas - o
 * chamador trata isso como falha transitoria.
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
      logger.error(SCOPE, "Falha ao chamar Claude para compor mensagem comercial", err);
    }
  }

  return null;
}
