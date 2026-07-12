import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import { FlowStateData } from "../../types";
import { logger } from "../../utils/logger";
import { StepDefinition } from "../types";
import { ABANDON_TOOL, abandonFlow } from "./shared";

const SCOPE = "conversation.clinicCancellation";

/**
 * Etapa em que a conversa entra quando a PROPRIA CLINICA cancela um
 * agendamento pelo CRM (ver src/services/clinicCancellationService.ts) - o
 * aviso de cancelamento + a pergunta "gostaria que eu encontrasse um novo
 * horario?" ja foram enviados nessa mesma mensagem. Aqui so falta interpretar
 * a resposta do cliente.
 */
export const offerStep: StepDefinition = {
  id: "CLINIC_CANCELLED_OFFER",
  instructions: (ctx) =>
    `Etapa: o cliente acabou de ser avisado que a clinica cancelou o agendamento de ${ctx.conversation.state_data.procedure} dele(a), e foi ` +
    "perguntado se quer que a IA encontre um novo horario agora. Se a resposta for positiva (ex: \"sim\", \"pode ser\", \"quero remarcar\", " +
    "\"claro\"), chame confirm_new_appointment. Se for negativa ou disser que prefere entrar em contato depois (ex: \"nao precisa\", \"vou marcar " +
    "outro dia\", \"depois eu chamo\"), chame decline_new_appointment. Nao repita perguntas sobre nome ou procedimento - ja sao conhecidos.",
  tools: [
    {
      name: "confirm_new_appointment",
      description: "Cliente aceitou que a IA busque um novo horario para remarcar o agendamento cancelado pela clinica.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "decline_new_appointment",
      description: "Cliente nao quer remarcar agora (vai entrar em contato depois, ou vai escolher outro dia por conta propria).",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_new_appointment: async (ctx) => {
      logger.info(SCOPE, "Cliente aceitou remarcar apos cancelamento pela clinica", { conversationId: ctx.conversation.id });
      const data: FlowStateData = { ...ctx.conversation.state_data };
      return {
        nextStep: "SCHEDULING_DATE",
        data,
        message: `Otimo! Procedimento (${data.procedure}) e paciente (${data.name}) ja conhecidos, nao precisa perguntar de novo. Peça a data desejada para o novo agendamento.`,
      };
    },
    decline_new_appointment: async (ctx) => {
      logger.info(SCOPE, "Cliente nao quis remarcar apos cancelamento pela clinica", { conversationId: ctx.conversation.id });
      const message = await aiKnowledgeService.getMessageTemplate("clinic_cancellation_decline");
      return { nextStep: "MENU", data: {}, message };
    },
    abandon_flow: abandonFlow,
  },
};

export const clinicCancellationSteps: StepDefinition[] = [offerStep];
