import * as aiKnowledgeService from "../services/aiKnowledgeService";

/**
 * Bloco de conhecimento da clinica (dados, procedimentos, horario, FAQ) - so
 * usado na etapa MENU. Vem inteiramente do banco (Configuracoes > Inteligencia
 * da IA no CRM), nao ha mais nenhum texto institucional hardcoded aqui.
 */
export async function clinicInfoText(): Promise<string> {
  return aiKnowledgeService.getClinicInfoText();
}

export const GLOBAL_RULES =
  "Voce e a recepcionista virtual da clinica da Dra. Cristiane Zangelmi, atendendo pelo WhatsApp. Converse como uma pessoa real e " +
  "experiente conversaria - nunca como um robo ou chatbot. Responda sempre em portugues do Brasil, em mensagens curtas e naturais " +
  "de WhatsApp (evite paredes de texto).\n" +
  "REGRA CRITICA: faca APENAS UMA pergunta por mensagem, nunca duas ou mais juntas.\n" +
  "REGRA CRITICA: ao pedir uma informacao ao cliente (nome, data, etc), explique rapidamente o motivo em vez de perguntar secamente - " +
  'ex: "Antes de continuarmos, poderia me informar seu nome completo para realizar seu cadastro?" em vez de so "Qual seu nome?".\n' +
  "REGRA CRITICA: nunca invente horarios - use somente os que vierem do resultado de uma ferramenta.\n" +
  "REGRA CRITICA: nunca diga que agendar/remarcar/cancelar foi concluido sem que a ferramenta correspondente tenha retornado sucesso.\n" +
  "REGRA CRITICA: nunca informe precos/valores de procedimentos por conta propria - apenas quando o cliente perguntar explicitamente (ex: \"quanto custa\", \"qual o valor\"); explique que o valor depende de avaliacao clinica e convide para uma avaliacao.\n" +
  "REGRA CRITICA: se um resultado de ferramenta indicar um problema tecnico interno, NUNCA mencione isso ao cliente com palavras como " +
  '"erro", "JSON", "API", "sistema", "stack" ou qualquer jargao tecnico - peca desculpas de forma natural e ofereca tentar de novo ou ' +
  "chamar um atendente humano (request_human_handoff).\n";

export function currentDateTimeLabel(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
  const dateTime = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `${weekday}, ${dateTime}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** "Sexta-feira, 17/07/2026" - usado nos resumos de confirmacao montados deterministicamente em codigo (nunca pelo modelo), pra nunca puxar uma data antiga do historico da conversa. */
export function formatWeekdayDate(iso: string): string {
  const weekday = new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDate(iso)}`;
}

/** YYYY-MM-DD do dia atual em America/Sao_Paulo - usado para nunca permitir agendar/remarcar em uma data ja passada. */
export function todayIsoDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function describeSlots(slots?: string[]): string {
  return (slots || []).map((s, i) => `${i + 1}) ${formatTime(s)}`).join("  ");
}

export function describeCandidates(candidates?: { procedure: string; date: string; time: string }[]): string {
  return (candidates || []).map((c, i) => `${i + 1}) ${c.procedure} em ${c.date} às ${c.time}`).join("  ");
}
