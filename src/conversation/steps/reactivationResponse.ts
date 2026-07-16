import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as reactivationEngine from "../../services/reactivationEngine";
import { logger } from "../../utils/logger";
import { StepDefinition } from "../types";
import { ABANDON_TOOL, HUMAN_HANDOFF_TOOL, abandonFlow, requestHumanHandoff } from "./shared";

const SCOPE = "conversation.reactivationResponse";

/**
 * Etapa em que a conversa entra logo apos o motor de reativacao
 * (src/services/reactivationEngine.ts) enviar a mensagem inicial de uma
 * campanha ou um lembrete de nao-resposta. O objetivo NAO e vender - e
 * retomar o relacionamento, entao qualquer sinal de interesse (cumprimento,
 * pergunta, vontade de agendar) deve virar atendimento normal imediatamente,
 * sem insistir na campanha.
 *
 * Cancelamento/remarcacao/agendamento NAO sao declarados aqui de proposito:
 * qualquer etapa fora do MENU ja ganha begin_scheduling/begin_rescheduling/
 * begin_cancellation automaticamente via steps/index.ts (SWITCH_TOOLS/
 * SWITCH_HANDLERS), reaproveitando exatamente os mesmos handlers usados em
 * qualquer outro lugar do sistema - agendar depois de reativado aciona o
 * motor de confirmacao de consulta sozinho, sem nenhum codigo novo.
 */
export const reactivationResponseStep: StepDefinition = {
  id: "REACTIVATION_RESPONSE",
  instructions: () =>
    "Etapa: o cliente acabou de receber uma mensagem espontanea da clinica perguntando como ele esta, depois de um tempo " +
    "sem vir. O objetivo NAO e vender, e retomar contato. Se a resposta demonstrar QUALQUER sinal de interesse, abertura " +
    'ou apenas cumprimento (ex: "oi", "boa tarde", "tudo bem", "quanto custa", "quero voltar", "quero marcar", "pode ' +
    'agendar", "estou interessado"), trate como uma conversa normal a partir de agora: se quiser agendar, chame ' +
    "begin_scheduling imediatamente; se for só uma pergunta ou cumprimento, responda normalmente em texto livre usando " +
    "as informações da clínica, sem chamar nenhuma ferramenta - NÃO insista em perguntar sobre a campanha ou mencionar " +
    'que essa mensagem foi uma reativação. Se o cliente disser explicitamente que não tem interesse (ex: "não tenho ' +
    'interesse", "não quero", "agora não", "não precisa"), chame decline_reactivation. Nunca insista depois de uma recusa.',
  tools: [
    {
      name: "decline_reactivation",
      description: "Cliente disse explicitamente que nao tem interesse em retomar o atendimento agora.",
      input_schema: { type: "object", properties: {} },
    },
    HUMAN_HANDOFF_TOOL,
    ABANDON_TOOL,
  ],
  handlers: {
    decline_reactivation: async (ctx) => {
      const { reactivationTargetId } = ctx.conversation.state_data;
      logger.info(SCOPE, "Paciente recusou reativacao", { conversationId: ctx.conversation.id, reactivationTargetId });
      if (reactivationTargetId) await reactivationEngine.declineTarget(reactivationTargetId);
      const message = await aiKnowledgeService.getMessageTemplate("reactivation_decline_ack");
      return { nextStep: "MENU", data: {}, message };
    },
    request_human_handoff: requestHumanHandoff,
    abandon_flow: abandonFlow,
  },
};
