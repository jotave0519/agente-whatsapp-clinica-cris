import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import { logger } from "../../utils/logger";
import { sampleSlotsAcrossDay } from "../../utils/slots";
import { ToolHandler, ToolSchema } from "../types";

export { sampleSlotsAcrossDay };

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
