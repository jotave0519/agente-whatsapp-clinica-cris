import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as commercialEngine from "../../services/commercialEngine";
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

export const HUMAN_HANDOFF_TOOL: ToolSchema = {
  name: "request_human_handoff",
  description: "Encerra o atendimento automatico e sinaliza que um atendente humano deve continuar a conversa.",
  input_schema: { type: "object", properties: { reason: { type: "string", description: "Motivo do encaminhamento" } }, required: ["reason"] },
};

export const requestHumanHandoff: ToolHandler = async (ctx, input) => {
  logger.info("conversation.shared", "Encaminhando para atendimento humano", { conversationId: ctx.conversation.id, reason: input.reason });
  return {
    nextStep: "MENU",
    data: {},
    message: JSON.stringify({ status: "handoff_requested", reason: input.reason }),
    handoffRequested: true,
  };
};

export const FLAG_OPPORTUNITY_TOOL: ToolSchema = {
  name: "flag_opportunity",
  description:
    "Registre quando o cliente demonstrar interesse comercial num procedimento sem confirmar agendamento AGORA: perguntou preco, " +
    "fez avaliacao e nao voltou, ou deu um sinal de hesitacao/adiamento (\"vou pensar\", \"ta caro\", \"vou viajar\", \"preciso " +
    "conversar com alguem\", \"depois eu vejo\"). NAO chame para agendamentos que ja vao acontecer (isso e begin_scheduling) nem " +
    "para reclamacoes/duvidas sem relacao com decidir por um procedimento.",
  input_schema: {
    type: "object",
    properties: {
      procedure: { type: "string", description: "Procedimento de interesse" },
      signal: {
        type: "string",
        enum: ["price_question", "general_interest", "will_think", "no_money", "traveling", "needs_to_talk", "come_back_later", "other"],
      },
      note: {
        type: "string",
        description: "Cite brevemente, com as palavras do proprio cliente quando possivel, o que ele disse - isso sera usado depois para compor mensagens de acompanhamento contextuais, nunca genericas.",
      },
    },
    required: ["procedure", "signal"],
  },
};

/**
 * Handler somente-efeito-colateral: NUNCA muda nextStep/data, sempre retorna
 * o estado/state_data atuais inalterados. E o que permite essa tool coexistir
 * com qualquer fluxo em andamento (ex: chamada junto de outra tool no mesmo
 * turno) sem apagar dados ja coletados - diferente de flag_concern/stop_followup
 * do pos-atendimento, que podem resetar pra MENU porque la sao a UNICA tool
 * possivel na etapa.
 */
export const flagOpportunity: ToolHandler = async (ctx, input) => {
  logger.info("conversation.shared", "Sinal comercial detectado", {
    conversationId: ctx.conversation.id,
    procedure: input.procedure,
    signal: input.signal,
  });
  try {
    await commercialEngine.flagSignal(ctx.user.id, String(input.procedure || ""), input.signal, input.note ? String(input.note).slice(0, 300) : null);
  } catch (err) {
    logger.error("conversation.shared", "Falha ao registrar oportunidade comercial", err);
  }
  return { nextStep: ctx.conversation.state, data: ctx.conversation.state_data, message: JSON.stringify({ status: "ok" }) };
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

  // Sinaliza pra IA Comercial quando um AGENDAMENTO (nunca remarcacao/cancelamento/
  // etapa de resposta espontanea) e abandonado com um procedimento ja conhecido -
  // captura ctx.conversation.state/state_data ANTES do reset abaixo, unico
  // momento em que essa informacao existe. Isolado em try/catch: uma falha aqui
  // nunca pode impedir o abandono normal do fluxo.
  if (ctx.conversation.state.startsWith("SCHEDULING_") && ctx.conversation.state_data.procedure) {
    try {
      await commercialEngine.flagAbandonedScheduling(ctx.user.id, ctx.conversation.state_data.procedure);
    } catch (err) {
      logger.error("conversation.shared", "Falha ao sinalizar oportunidade comercial (abandono de agendamento)", err);
    }
  }

  const message = await aiKnowledgeService.getMessageTemplate("abandon_flow");
  return { nextStep: "MENU", data: {}, message };
};
