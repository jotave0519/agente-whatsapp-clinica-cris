import * as schedulingService from "../../services/schedulingService";
import { FlowStateData } from "../../types";
import { logger } from "../../utils/logger";
import { describeCandidates, describeSlots, formatDate, formatTime } from "../prompt";
import { FlowContext, StepDefinition, StepResult, ToolHandler } from "../types";
import { ABANDON_TOOL, abandonFlow } from "./shared";

const SCOPE = "conversation.rescheduling";

export const beginRescheduling: ToolHandler = async (ctx) => {
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
      nextStep: "RESCHEDULING_DATE",
      data: { scheduleId: appt.id, procedure: appt.procedure },
      message: `Agendamento encontrado: ${appt.procedure} em ${appt.date} às ${appt.time}. Informe isso ao cliente e pergunte para qual nova data ele quer remarcar.`,
    };
  }

  const candidates = appointments.map((a) => ({ scheduleId: a.id, procedure: a.procedure, date: a.date, time: a.time }));
  return {
    nextStep: "RESCHEDULING_SELECT",
    data: { candidates },
    message: `Vários agendamentos ativos encontrados: ${describeCandidates(candidates)}. Liste-os numerados ao cliente e pergunte qual ele quer remarcar.`,
  };
};

export const selectStep: StepDefinition = {
  id: "RESCHEDULING_SELECT",
  instructions: (ctx) =>
    `Etapa: o cliente tem varios agendamentos ativos: ${describeCandidates(
      ctx.conversation.state_data.candidates
    )}. Liste-os numerados e pergunte qual ele quer remarcar. Se ja escolheu, chame select_appointment com o NUMERO da opcao (index, comecando em 1).`,
  tools: [
    {
      name: "select_appointment",
      description: "Seleciona qual agendamento existente o cliente quer remarcar, pelo numero da opcao apresentada (1, 2, 3...).",
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
          nextStep: "RESCHEDULING_SELECT",
          data: ctx.conversation.state_data,
          message: `Opcao invalida. Opcoes validas: ${describeCandidates(candidates)}. Peça ao cliente para escolher um desses numeros.`,
        };
      }

      return {
        nextStep: "RESCHEDULING_DATE",
        data: { scheduleId: candidate.scheduleId, procedure: candidate.procedure },
        message: "Agendamento selecionado. Pergunte para qual nova data o cliente quer remarcar.",
      };
    },
    abandon_flow: abandonFlow,
  },
};

export const dateStep: StepDefinition = {
  id: "RESCHEDULING_DATE",
  instructions: (ctx) =>
    `Etapa: falta a nova data desejada para remarcar (procedimento: ${ctx.conversation.state_data.procedure}). Se a mensagem ja contem uma data, ` +
    "chame provide_date com a data no formato YYYY-MM-DD. Caso contrario, pergunte (apenas) a nova data.",
  tools: [
    {
      name: "provide_date",
      description: "Registra a nova data desejada e consulta a disponibilidade real no Google Calendar.",
      input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_date: async (ctx, input) => {
      const baseData = ctx.conversation.state_data;
      const durationMinutes = baseData.durationMinutes ?? 30;
      logger.info(SCOPE, "Consultando disponibilidade para remarcacao", { conversationId: ctx.conversation.id, date: input.date, durationMinutes });
      const slots = await schedulingService.checkAvailability(input.date, durationMinutes);
      logger.info(SCOPE, "Disponibilidade recebida", { date: input.date, slotCount: slots.length });

      if (slots.length === 0) {
        return { nextStep: "RESCHEDULING_DATE", data: baseData, message: `Nenhum horario livre em ${input.date}. Peça outra data ao cliente.` };
      }

      const data: FlowStateData = { ...baseData, date: input.date, availableSlots: slots.slice(0, 6) };
      return {
        nextStep: "RESCHEDULING_TIME",
        data,
        message: `Horarios disponiveis em ${input.date}: ${describeSlots(data.availableSlots)}. Apresente essas opcoes numeradas e pergunte qual prefere.`,
      };
    },
    abandon_flow: abandonFlow,
  },
};

export const timeStep: StepDefinition = {
  id: "RESCHEDULING_TIME",
  instructions: (ctx) =>
    `Etapa: falta escolher o novo horario. Opcoes disponiveis: ${describeSlots(
      ctx.conversation.state_data.availableSlots
    )}. Apresente-as numeradas e pergunte qual prefere. Se ja escolheu, chame select_time com o NUMERO da opcao (index, comecando em 1).`,
  tools: [
    {
      name: "select_time",
      description: "Registra o novo horario escolhido pelo cliente, pelo numero da opcao apresentada (1, 2, 3...).",
      input_schema: { type: "object", properties: { index: { type: "integer", description: "Numero da opcao escolhida, comecando em 1" } }, required: ["index"] },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    select_time: async (ctx, input) => {
      const data = ctx.conversation.state_data;
      const slots = data.availableSlots || [];
      const start = slots[Number(input.index) - 1];

      if (!start) {
        return {
          nextStep: "RESCHEDULING_TIME",
          data,
          message: `Opcao invalida. As opcoes validas sao: ${describeSlots(slots)}. Peça ao cliente para escolher um desses numeros.`,
        };
      }

      const newData: FlowStateData = { ...data, selectedStart: start };
      logger.info(SCOPE, "Novo horario selecionado", { conversationId: ctx.conversation.id, start });
      return {
        nextStep: "RESCHEDULING_CONFIRM",
        data: newData,
        message: `Horario selecionado: ${formatDate(start)} as ${formatTime(start)}. Repita os dados e peça confirmação explícita.`,
      };
    },
    abandon_flow: abandonFlow,
  },
};

export async function confirmRescheduling(ctx: FlowContext): Promise<StepResult> {
  const { scheduleId, selectedStart, durationMinutes } = ctx.conversation.state_data;

  if (!scheduleId || !selectedStart) {
    logger.warn(SCOPE, "confirmRescheduling chamado sem dados completos", ctx.conversation.state_data);
    return {
      nextStep: "MENU",
      data: {},
      message: "Faltaram informações para concluir a remarcação. Peça desculpas e pergunte se o cliente quer tentar novamente.",
    };
  }

  logger.info(SCOPE, "Atualizando agendamento", { conversationId: ctx.conversation.id, scheduleId, selectedStart });
  try {
    await schedulingService.rescheduleAppointment(scheduleId, selectedStart, durationMinutes);
    logger.info(SCOPE, "Remarcação concluída com sucesso", { conversationId: ctx.conversation.id });
    return {
      nextStep: "MENU",
      data: {},
      message: `Remarcação confirmada! 😊\n\nSeu novo horário é ${formatDate(selectedStart)} às ${formatTime(selectedStart)}.\n\nPosso ajudar com mais alguma coisa?`,
    };
  } catch (err: any) {
    logger.error(SCOPE, "Falha ao remarcar", err);
    return {
      nextStep: "RESCHEDULING_CONFIRM",
      data: ctx.conversation.state_data,
      message: `Desculpe, tive um problema técnico ao remarcar (${err.message}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.`,
    };
  }
}

export const confirmStep: StepDefinition = {
  id: "RESCHEDULING_CONFIRM",
  instructions: (ctx) =>
    `Etapa: aguardando confirmacao final da remarcacao para ${ctx.conversation.state_data.selectedStart}. Peça confirmação explícita. ` +
    "Se ja confirmou, chame confirm_rescheduling.",
  tools: [
    {
      name: "confirm_rescheduling",
      description: "Confirma e aplica a remarcacao (Google Calendar + Supabase). Só chamar apos confirmacao explicita do cliente.",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_rescheduling: async (ctx) => confirmRescheduling(ctx),
    abandon_flow: abandonFlow,
  },
};

export const reschedulingSteps: StepDefinition[] = [selectStep, dateStep, timeStep, confirmStep];
