import { ToolHandler, ToolSchema } from "../types";
import { logger } from "../../utils/logger";

export const ABANDON_TOOL: ToolSchema = {
  name: "abandon_flow",
  description: "Aborta o fluxo atual (agendamento/remarcacao/cancelamento) e volta ao atendimento geral, a pedido explicito do cliente.",
  input_schema: { type: "object", properties: {} },
};

export const abandonFlow: ToolHandler = async (ctx) => {
  logger.info("conversation.shared", "Fluxo abandonado a pedido do cliente", {
    conversationId: ctx.conversation.id,
    estadoAnterior: ctx.conversation.state,
  });
  return {
    nextStep: "MENU",
    data: {},
    message: "Sem problemas, deixei esse atendimento de lado. Posso ajudar com mais alguma coisa?",
  };
};
