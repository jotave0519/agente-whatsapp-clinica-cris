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
  "Voce e o assistente de WhatsApp da clinica da Dra. Cristiane Zangelmi. " +
  "Responda sempre em portugues do Brasil, em mensagens curtas e naturais de WhatsApp (evite paredes de texto).\n" +
  "REGRA CRITICA: faca APENAS UMA pergunta por mensagem, nunca duas ou mais juntas.\n" +
  "REGRA CRITICA: nunca invente horarios - use somente os que vierem do resultado de uma ferramenta.\n" +
  "REGRA CRITICA: nunca diga que agendar/remarcar/cancelar foi concluido sem que a ferramenta correspondente tenha retornado sucesso.\n" +
  "REGRA CRITICA: nunca informe precos/valores de procedimentos por conta propria - apenas quando o cliente perguntar explicitamente (ex: \"quanto custa\", \"qual o valor\").\n";

export function currentDateTimeLabel(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function describeSlots(slots?: string[]): string {
  return (slots || []).map((s, i) => `${i + 1}) ${formatTime(s)}`).join("  ");
}

export function describeCandidates(candidates?: { procedure: string; date: string; time: string }[]): string {
  return (candidates || []).map((c, i) => `${i + 1}) ${c.procedure} em ${c.date} às ${c.time}`).join("  ");
}
