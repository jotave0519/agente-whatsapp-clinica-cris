import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as schedulingService from "../../services/schedulingService";
import { logger } from "../../utils/logger";
import { describeCandidates } from "../prompt";
import { FlowContext, StepDefinition, StepResult, ToolHandler } from "../types";
import { ABANDON_TOOL, abandonFlow } from "./shared";

const SCOPE = "conversation.cancellation";

export const beginCancellation: ToolHandler = async (ctx) => {
  logger.info(SCOPE, "Buscando agendamentos ativos", { conversationId: ctx.conversation.id, userId: ctx.user.id });
  const appointments = await schedulingService.findAppointmentsForUser(ctx.user.id);
  logger.info(SCOPE, "Agendamentos encontrados", { count: appointments.length });

  if (appointments.length === 0) {
    return {
      nextStep: "MENU",
      data: {},
      message: "O cliente não possui agendamentos ativos. Informe isso e pergunte se pode ajudar em outra coisa.",
    };
  }

  if (appointments.length === 1) {
    const appt = appointments[0];
    return {
      nextStep: "CANCELING_CONFIRM",
      data: { scheduleId: appt.id, procedure: appt.procedure, date: appt.date },
      message: `Agendamento encontrado: ${appt.procedure} em ${appt.date} às ${appt.time}. Confirme com o cliente se ele realmente deseja cancelar.`,
    };
  }

  const candidates = appointments.map((a) => ({ scheduleId: a.id, procedure: a.procedure, date: a.date, time: a.time }));
  return {
    nextStep: "CANCELING_SELECT",
    data: { candidates },
    message: `Vários agendamentos ativos encontrados: ${describeCandidates(candidates)}. Liste-os numerados ao cliente e pergunte qual ele quer cancelar.`,
  };
};

export const selectStep: StepDefinition = {
  id: "CANCELING_SELECT",
  instructions: (ctx) =>
    `Etapa: o cliente tem varios agendamentos ativos: ${describeCandidates(
      ctx.conversation.state_data.candidates
    )}. Liste-os numerados e pergunte qual ele quer cancelar. Se ja escolheu, chame select_appointment com o NUMERO da opcao (index, comecando em 1).`,
  tools: [
    {
      name: "select_appointment",
      description: "Seleciona qual agendamento existente o cliente quer cancelar, pelo numero da opcao apresentada (1, 2, 3...).",
      input_schema: { type: "object", properties: { index: { type: "integer", description: "Numero da opcao escolhida, comecando em 1" } }, required: ["index"] },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    select_appointment: async (ctx, input) => {
      const candidates = ctx.conversation.state_data.candidates || [];
      const candidate = candidates[Number(input.index) - 1];

      if (!candidate) {
        return {
          nextStep: "CANCELING_SELECT",
          data: ctx.conversation.state_data,
          message: `Opcao invalida. Opcoes validas: ${describeCandidates(candidates)}. Peça ao cliente para escolher um desses numeros.`,
        };
      }

      return {
        nextStep: "CANCELING_CONFIRM",
        data: { scheduleId: candidate.scheduleId, procedure: candidate.procedure, date: candidate.date },
        message: `Confirme com o cliente se ele realmente deseja cancelar ${candidate.procedure} em ${candidate.date}.`,
      };
    },
    abandon_flow: abandonFlow,
  },
};

export async function confirmCancellation(ctx: FlowContext): Promise<StepResult> {
  const { scheduleId } = ctx.conversation.state_data;

  if (!scheduleId) {
    logger.warn(SCOPE, "confirmCancellation chamado sem dados completos", ctx.conversation.state_data);
    return {
      nextStep: "MENU",
      data: {},
      message: "Faltaram informações para concluir o cancelamento. Peça desculpas e pergunte se o cliente quer tentar novamente.",
    };
  }

  logger.info(SCOPE, "Cancelando agendamento", { conversationId: ctx.conversation.id, scheduleId });
  try {
    await schedulingService.cancelAppointment(scheduleId);
    logger.info(SCOPE, "Cancelamento concluído com sucesso", { conversationId: ctx.conversation.id });
    const message = await aiKnowledgeService.getMessageTemplate("confirm_cancellation_success");
    return { nextStep: "MENU", data: {}, message };
  } catch (err: any) {
    logger.error(SCOPE, "Falha ao cancelar", err);
    const message = await aiKnowledgeService.getMessageTemplate("confirm_cancellation_failure", { error: err.message });
    return { nextStep: "CANCELING_CONFIRM", data: ctx.conversation.state_data, message };
  }
}

export const confirmStep: StepDefinition = {
  id: "CANCELING_CONFIRM",
  instructions: (ctx) =>
    `Etapa: aguardando confirmacao final do cancelamento de ${ctx.conversation.state_data.procedure} em ${ctx.conversation.state_data.date}. ` +
    "Peça confirmação explícita. Se ja confirmou, chame confirm_cancellation.",
  tools: [
    {
      name: "confirm_cancellation",
      description: "Confirma e executa o cancelamento (Google Calendar + Supabase). Só chamar apos confirmacao explicita do cliente.",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_cancellation: async (ctx) => confirmCancellation(ctx),
    abandon_flow: abandonFlow,
  },
};

export const cancellationSteps: StepDefinition[] = [selectStep, confirmStep];
