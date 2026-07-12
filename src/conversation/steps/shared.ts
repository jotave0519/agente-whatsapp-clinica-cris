import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import { logger } from "../../utils/logger";
import { sampleSlotsAcrossDay } from "../../utils/slots";
import { ToolHandler, ToolSchema } from "../types";

export { sampleSlotsAcrossDay };

/** Usada quando o Google Calendar esta indisponivel (rede/timeout/auth) - nunca expor o erro tecnico ao cliente. */
export const CALENDAR_UNAVAILABLE_INSTRUCTION =
  'Diga exatamente esta frase ao cliente, sem parafrasear nem adicionar detalhes tecnicos: "Estou com dificuldade para consultar nossa agenda ' +
  'neste momento. Posso pedir para nossa equipe confirmar esse horário com você." Nao mencione Google Calendar, erro, codigo ou qualquer termo tecnico.';

/** Usada quando uma revalidacao no momento da confirmacao mostra que o horario escolhido acabou de ser ocupado por outra pessoa. */
export const SLOT_TAKEN_INSTRUCTION =
  'Diga exatamente esta frase ao cliente: "Enquanto conversávamos esse horário acabou de ser ocupado. Vou verificar outra opção disponível."';

export const ABANDON_TOOL: ToolSchema = {
  name: "abandon_flow",
  description: "Aborta o fluxo atual (agendamento/remarcacao/cancelamento) e volta ao atendimento geral, a pedido explicito do cliente.",
  input_schema: { type: "object", properties: {} },
};

/**
 * Checagem deterministica de nome completo (>=2 palavras), usada tanto para
 * validar o que o cliente digita quanto para decidir se o nome ja cadastrado
 * em ctx.user.name pode ser reaproveitado sem perguntar de novo.
 */
export function looksLikeFullName(name: string | undefined | null): boolean {
  if (!name) return false;
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

export const abandonFlow: ToolHandler = async (ctx) => {
  logger.info("conversation.shared", "Fluxo abandonado a pedido do cliente", {
    conversationId: ctx.conversation.id,
    estadoAnterior: ctx.conversation.state,
  });
  const message = await aiKnowledgeService.getMessageTemplate("abandon_flow");
  return { nextStep: "MENU", data: {}, message };
};
