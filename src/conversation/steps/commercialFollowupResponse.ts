import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as commercialEngine from "../../services/commercialEngine";
import { logger } from "../../utils/logger";
import { StepDefinition } from "../types";
import { ABANDON_TOOL, FLAG_OPPORTUNITY_TOOL, HUMAN_HANDOFF_TOOL, abandonFlow, flagOpportunity, requestHumanHandoff } from "./shared";

const SCOPE = "conversation.commercialFollowupResponse";

/**
 * Etapa em que a conversa entra logo apos o motor comercial
 * (src/services/commercialEngine.ts) enviar uma mensagem de acompanhamento
 * espontanea sobre um interesse anterior do paciente num procedimento. O
 * objetivo NUNCA e insistir - e reabrir a porta com leveza, sempre citando o
 * contexto real (o que o paciente disse antes), nunca de forma generica.
 *
 * Cancelamento/remarcacao/agendamento NAO sao declarados aqui de proposito:
 * qualquer etapa fora do MENU ja ganha begin_scheduling/begin_rescheduling/
 * begin_cancellation automaticamente via steps/index.ts (SWITCH_TOOLS/
 * SWITCH_HANDLERS) - e o que garante "sem perder contexto" quando o cliente
 * disser "quero marcar": o mesmo begin_scheduling usado em qualquer outro
 * lugar do sistema, so que aqui a instrucao abaixo pede pra pre-preencher o
 * procedimento com commercialProcedureInterest, sem perguntar de novo.
 */
export const commercialFollowupResponseStep: StepDefinition = {
  id: "COMMERCIAL_FOLLOWUP_RESPONSE",
  instructions: (ctx) => {
    const { commercialProcedureInterest } = ctx.conversation.state_data;
    const procedure = commercialProcedureInterest || "um procedimento";
    return (
      "Etapa: o paciente esta respondendo a uma mensagem espontanea de acompanhamento comercial sobre o interesse dele em " +
      `${procedure}. Converse como uma recepcionista atenciosa que se lembra da conversa - NUNCA insistente, NUNCA use ` +
      "gatilho de urgencia/escassez (\"só até amanhã\", \"últimas vagas\"), NUNCA repita uma pergunta ja feita, NUNCA cobre " +
      "uma resposta.\n\n" +
      "Se a resposta indicar que o paciente quer agendar/marcar, chame begin_scheduling AGORA MESMO, preenchendo o campo " +
      `procedure com "${procedure}" caso ele nao tenha dito outro procedimento nesta mensagem - NAO pergunte de novo o que ` +
      "ele ja demonstrou interesse antes.\n\n" +
      "Se a resposta for uma nova objecao ou sinal (ex: \"vou pensar\", \"ta caro\", \"vou viajar\", \"preciso conversar com " +
      "alguem\", \"depois eu vejo\"), acolha sem insistir e chame flag_opportunity para registrar esse sinal atualizado - NAO " +
      "tente reverter a objecao nem argumentar, apenas mostre que a porta continua aberta quando ele quiser.\n\n" +
      "Se pedir para nao receber mais esse tipo de mensagem, chame stop_contact. Para qualquer outro motivo de encaminhamento " +
      "a um atendente humano, chame request_human_handoff. NUNCA informe preco por conta propria (regra global ja cobre isso)."
    );
  },
  tools: [
    FLAG_OPPORTUNITY_TOOL,
    {
      name: "stop_contact",
      description: "Paciente pediu explicitamente para nao receber mais mensagens de acompanhamento comercial.",
      input_schema: { type: "object", properties: {} },
    },
    HUMAN_HANDOFF_TOOL,
    ABANDON_TOOL,
  ],
  handlers: {
    flag_opportunity: flagOpportunity,
    stop_contact: async (ctx) => {
      const { commercialOpportunityId } = ctx.conversation.state_data;
      logger.info(SCOPE, "Paciente pediu para parar contato comercial", { conversationId: ctx.conversation.id, commercialOpportunityId });
      if (commercialOpportunityId) await commercialEngine.stopContact(commercialOpportunityId);
      const message = await aiKnowledgeService.getMessageTemplate("commercial_stop_ack");
      return { nextStep: "MENU", data: {}, message };
    },
    request_human_handoff: requestHumanHandoff,
    abandon_flow: abandonFlow,
  },
};
