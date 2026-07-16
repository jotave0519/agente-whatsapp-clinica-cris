import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as reminderEngine from "../../services/reminderEngine";
import { logger } from "../../utils/logger";
import { StepDefinition } from "../types";
import { ABANDON_TOOL, abandonFlow } from "./shared";

const SCOPE = "conversation.reminderResponse";

/**
 * Etapa em que a conversa entra logo apos o motor de confirmacao
 * (src/services/reminderEngine.ts) enviar o pedido de confirmacao ou um dos
 * lembretes de nao-resposta - a pergunta "voce confirma sua presenca?" (ou o
 * lembrete "so passando pra lembrar") ja foi enviada nessa mesma mensagem,
 * seja na primeira tentativa ou numa cutucada seguinte. Aqui so falta
 * interpretar a resposta do cliente, seja qual for a tentativa que a gerou.
 *
 * Cancelamento/remarcacao NAO sao declarados aqui de proposito: qualquer
 * etapa fora do MENU ja ganha begin_scheduling/begin_rescheduling/
 * begin_cancellation automaticamente via steps/index.ts (SWITCH_TOOLS/
 * SWITCH_HANDLERS), reaproveitando exatamente os mesmos handlers usados em
 * qualquer outro lugar do sistema - nao duplicar essa logica aqui.
 */
export const reminderResponseStep: StepDefinition = {
  id: "REMINDER_RESPONSE",
  instructions: (ctx) => {
    const { procedure, date, time } = ctx.conversation.state_data;
    return (
      `Etapa: o cliente acabou de receber um pedido de confirmacao (ou lembrete de nao-resposta) da consulta de ${procedure} em ${date} as ${time}. ` +
      'Se ele confirmar presenca (ex: "sim", "confirmado", "estarei ai", "pode contar comigo", "ok"), chame confirm_appointment. ' +
      'Se disser que nao vai poder ir ou pedir para cancelar (ex: "preciso cancelar", "nao vou conseguir"), chame begin_cancellation. ' +
      'Se quiser mudar o horario (ex: "quero remarcar"), chame begin_rescheduling. ' +
      "Se fizer uma pergunta solta no meio (ex: endereco, duracao, forma de pagamento), responda normalmente usando as informacoes " +
      "da clinica abaixo em texto livre, SEM chamar nenhuma ferramenta - a pergunta de confirmacao continua em aberto para a proxima resposta. " +
      "Nao repita nome, procedimento ou horario - ja sao conhecidos."
    );
  },
  tools: [
    {
      name: "confirm_appointment",
      description: "Paciente confirmou presenca na consulta em resposta a um lembrete automatico.",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_appointment: async (ctx) => {
      const { scheduleId } = ctx.conversation.state_data;
      logger.info(SCOPE, "Presenca confirmada via lembrete", { conversationId: ctx.conversation.id, scheduleId });
      if (scheduleId) await reminderEngine.confirmAppointment(scheduleId);
      const message = await aiKnowledgeService.getMessageTemplate("reminder_confirm_ack");
      return { nextStep: "MENU", data: {}, message };
    },
    abandon_flow: abandonFlow,
  },
};
