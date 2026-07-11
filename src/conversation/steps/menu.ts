import * as businessHoursService from "../../services/businessHoursService";
import * as schedulingService from "../../services/schedulingService";
import { logger } from "../../utils/logger";
import { clinicInfoText } from "../prompt";
import { FlowContext, StepDefinition } from "../types";
import { SWITCH_HANDLERS, SWITCH_TOOLS } from "./switchFlow";

const SCOPE = "conversation.menu";

export const menuStep: StepDefinition = {
  id: "MENU",
  instructions: async (ctx: FlowContext) => {
    let text =
      "Voce esta no atendimento geral. Use as informacoes da clinica abaixo para tirar duvidas.\n" +
      "REGRA CRITICA: assim que perceber QUALQUER sinal de que o cliente quer agendar, remarcar ou cancelar " +
      '(ex: "quero agendar um horario", "quero marcar Botox", "preciso remarcar"), chame IMEDIATAMENTE ' +
      "begin_scheduling, begin_rescheduling ou begin_cancellation NA MESMA RESPOSTA - mesmo que ainda nao saiba " +
      "o procedimento, nome ou data. NUNCA faca perguntas de esclarecimento ou peça confirmação em texto livre " +
      "antes de chamar essa ferramenta - e a propria ferramenta e as etapas seguintes que vao conduzir as " +
      "perguntas, uma de cada vez. A intencao de agendar tem prioridade sobre explicar o procedimento ou " +
      "informar preco: se o cliente disser \"quero agendar Botox\", va direto para o agendamento.\n";

    if (ctx.isFirstMessage) {
      text +=
        "Esta e a primeira mensagem deste cliente na conversa: cumprimente-o pelo nome (se souber) e apresente " +
        "as opcoes principais (1. Agendar avaliacao, 2. Remarcar agendamento, 3. Cancelar agendamento, " +
        "4. Conhecer nossos tratamentos, 5. Falar com um atendente), mas tambem entenda linguagem natural livremente.\n";
    }

    const hoursLabel = await businessHoursService.describeWeeklyHoursLabel();
    return text + "\n\n---\n\n" + clinicInfoText(hoursLabel);
  },
  tools: [
    ...SWITCH_TOOLS,
    {
      name: "confirm_appointment",
      description: "Marca um agendamento como confirmado pelo paciente (ex: em resposta a um lembrete de consulta).",
      input_schema: { type: "object", properties: { schedule_id: { type: "string" } }, required: ["schedule_id"] },
    },
    {
      name: "request_human_handoff",
      description: "Encerra o atendimento automatico e sinaliza que um atendente humano deve continuar a conversa.",
      input_schema: { type: "object", properties: { reason: { type: "string", description: "Motivo do encaminhamento" } }, required: ["reason"] },
    },
  ],
  handlers: {
    ...SWITCH_HANDLERS,
    confirm_appointment: async (ctx, input) => {
      logger.info(SCOPE, "Confirmando presenca (pos-lembrete)", { conversationId: ctx.conversation.id, scheduleId: input.schedule_id });
      await schedulingService.confirmAppointment(input.schedule_id);
      return { nextStep: "MENU", data: {}, message: JSON.stringify({ status: "confirmed" }) };
    },
    request_human_handoff: async (ctx, input) => {
      logger.info(SCOPE, "Encaminhando para atendimento humano", { conversationId: ctx.conversation.id, reason: input.reason });
      return {
        nextStep: "MENU",
        data: {},
        message: JSON.stringify({ status: "handoff_requested", reason: input.reason }),
        handoffRequested: true,
      };
    },
  },
};
