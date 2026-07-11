import * as schedulingService from "../../services/schedulingService";
import { FlowStateData } from "../../types";
import { logger } from "../../utils/logger";
import { describeSlots, formatDate, formatTime } from "../prompt";
import { FlowContext, StepDefinition, StepResult, ToolHandler } from "../types";
import { ABANDON_TOOL, abandonFlow, looksLikeFullName } from "./shared";

const SCOPE = "conversation.scheduling";
const CLINIC_ADDRESS = "Estrada Santa Isabel, 965, Sala 23, Edifício Comercial Arujazinho, Arujá - SP";

/**
 * Consulta disponibilidade real no Google Calendar para a data informada.
 * Usada tanto pela etapa SCHEDULING_DATE quanto por begin_scheduling quando
 * o cliente ja informa a data na mesma mensagem que inicia o fluxo.
 */
export async function provideDate(ctx: FlowContext, baseData: FlowStateData, date: string): Promise<StepResult> {
  const durationMinutes = baseData.durationMinutes ?? 30;
  logger.info(SCOPE, "Consultando disponibilidade", { conversationId: ctx.conversation.id, date, durationMinutes });
  const slots = await schedulingService.checkAvailability(date, durationMinutes);
  logger.info(SCOPE, "Disponibilidade recebida", { date, slotCount: slots.length });

  if (slots.length === 0) {
    return { nextStep: "SCHEDULING_DATE", data: baseData, message: `Nenhum horario livre em ${date}. Peça outra data ao cliente.` };
  }

  const data: FlowStateData = { ...baseData, date, availableSlots: slots.slice(0, 6) };
  return {
    nextStep: "SCHEDULING_TIME",
    data,
    message: `Horarios disponiveis em ${date}: ${describeSlots(data.availableSlots)}. Apresente essas opcoes numeradas (formato HH:MM) e pergunte qual o cliente prefere.`,
  };
}

/**
 * Inicia (ou reinicia, no caso de troca de fluxo em outra etapa) o fluxo de
 * agendamento. Reaproveita o nome ja cadastrado do cliente (ctx.user.name)
 * quando ele parece completo, para nao perguntar de novo algo ja conhecido.
 */
export const beginScheduling: ToolHandler = async (ctx, input) => {
  const data: FlowStateData = {};
  if (input.procedure) data.procedure = input.procedure;
  if (input.name) data.name = input.name;
  logger.info(SCOPE, "Iniciando fluxo de agendamento", { conversationId: ctx.conversation.id, input });

  if (!data.procedure) {
    return { nextStep: "SCHEDULING_PROCEDURE", data, message: "Fluxo de agendamento iniciado. Peça (apenas) qual procedimento o cliente deseja agendar." };
  }

  if (!data.name && looksLikeFullName(ctx.user.name)) {
    data.name = ctx.user.name;
    logger.info(SCOPE, "Nome ja cadastrado reaproveitado", { conversationId: ctx.conversation.id, name: ctx.user.name });
  }

  if (!data.name) {
    return { nextStep: "SCHEDULING_NAME", data, message: `Procedimento registrado: ${data.procedure}. Peça o nome completo do paciente.` };
  }
  if (input.date) {
    return provideDate(ctx, data, input.date);
  }
  return { nextStep: "SCHEDULING_DATE", data, message: `Procedimento registrado: ${data.procedure}. Nome já conhecido (${data.name}), não precisa perguntar de novo. Peça a data desejada.` };
};

export const procedureStep: StepDefinition = {
  id: "SCHEDULING_PROCEDURE",
  instructions: () =>
    "Etapa: falta saber qual procedimento o cliente quer agendar. Se a ultima mensagem ja contem o procedimento " +
    "(ex: Botox, preenchimento, limpeza de pele, avaliacao), chame provide_procedure com esse valor. Caso contrario, " +
    "pergunte (apenas) qual procedimento ele deseja agendar. Nao explique o procedimento nem informe preco aqui.",
  tools: [
    {
      name: "provide_procedure",
      description: "Registra o procedimento que o cliente quer agendar.",
      input_schema: { type: "object", properties: { procedure: { type: "string" } }, required: ["procedure"] },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_procedure: async (ctx, input) => {
      const data: FlowStateData = { ...ctx.conversation.state_data, procedure: input.procedure };
      logger.info(SCOPE, "Procedimento registrado", { conversationId: ctx.conversation.id, procedure: input.procedure });
      if (data.name) {
        return { nextStep: "SCHEDULING_DATE", data, message: `Procedimento registrado: ${input.procedure}. Nome ja conhecido. Peça a data desejada.` };
      }
      return { nextStep: "SCHEDULING_NAME", data, message: `Procedimento registrado: ${input.procedure}. Peça o nome completo do paciente.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const nameStep: StepDefinition = {
  id: "SCHEDULING_NAME",
  instructions: (ctx) =>
    `Etapa: falta o nome completo do paciente (procedimento: ${ctx.conversation.state_data.procedure}). ` +
    "Se a ultima mensagem ja contem o nome, chame provide_name. Caso contrario, pergunte (apenas) o nome completo.",
  tools: [
    {
      name: "provide_name",
      description: "Registra o nome completo do paciente informado pelo cliente.",
      input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_name: async (ctx, input) => {
      if (!looksLikeFullName(input.name)) {
        logger.info(SCOPE, "Nome incompleto informado, permanecendo na etapa", { conversationId: ctx.conversation.id, name: input.name });
        return {
          nextStep: "SCHEDULING_NAME",
          data: ctx.conversation.state_data,
          message:
            `O cliente informou "${input.name}", que parece incompleto (falta sobrenome). NAO repita a pergunta anterior de forma identica: ` +
            "explique de forma natural que falta o sobrenome para completar o cadastro e peça só isso.",
        };
      }
      const data: FlowStateData = { ...ctx.conversation.state_data, name: input.name };
      logger.info(SCOPE, "Nome registrado", { conversationId: ctx.conversation.id, name: input.name });
      return { nextStep: "SCHEDULING_DATE", data, message: `Nome registrado: ${input.name}. Peça a data desejada.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const dateStep: StepDefinition = {
  id: "SCHEDULING_DATE",
  instructions: (ctx) => {
    const { procedure, name } = ctx.conversation.state_data;
    return (
      `Etapa: falta a data desejada (procedimento: ${procedure}, paciente: ${name}). Se a ultima mensagem ja contem uma data, ` +
      'chame provide_date com a data no formato YYYY-MM-DD (resolva termos relativos como "amanha"/"segunda" usando a data atual informada). ' +
      "Caso contrario, pergunte (apenas) a data desejada."
    );
  },
  tools: [
    {
      name: "provide_date",
      description: "Registra a data desejada e consulta a disponibilidade real no Google Calendar.",
      input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_date: async (ctx, input) => provideDate(ctx, ctx.conversation.state_data, input.date),
    abandon_flow: abandonFlow,
  },
};

export const timeStep: StepDefinition = {
  id: "SCHEDULING_TIME",
  instructions: (ctx) =>
    `Etapa: falta escolher o horario. Opcoes disponiveis (ja consultadas no Google Calendar): ${describeSlots(
      ctx.conversation.state_data.availableSlots
    )}. Apresente essas opcoes numeradas ao cliente (formato HH:MM) e pergunte qual ele prefere. Se o cliente ja ` +
    "escolheu (por numero, horario ou descricao como \"o das 10h\"), chame select_time com o NUMERO da opcao (index, comecando em 1).",
  tools: [
    {
      name: "select_time",
      description: "Registra o horario escolhido pelo cliente, pelo numero da opcao apresentada (1, 2, 3...).",
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
          nextStep: "SCHEDULING_TIME",
          data,
          message: `Opcao invalida. As opcoes validas sao: ${describeSlots(slots)}. Peça ao cliente para escolher um desses numeros.`,
        };
      }

      const newData: FlowStateData = { ...data, selectedStart: start };
      logger.info(SCOPE, "Horario selecionado", { conversationId: ctx.conversation.id, start });
      return {
        nextStep: "SCHEDULING_CONFIRM",
        data: newData,
        message: `Horario selecionado: ${formatDate(start)} as ${formatTime(start)}. Repita os dados (nome, procedimento, data, horario) e peça confirmação explícita ao cliente.`,
      };
    },
    abandon_flow: abandonFlow,
  },
};

export async function confirmScheduling(ctx: FlowContext): Promise<StepResult> {
  const { name, procedure, selectedStart, durationMinutes } = ctx.conversation.state_data;

  if (!name || !procedure || !selectedStart) {
    logger.warn(SCOPE, "confirmScheduling chamado sem dados completos", ctx.conversation.state_data);
    return {
      nextStep: "MENU",
      data: {},
      message: "Faltaram informações para concluir o agendamento. Peça desculpas e pergunte se o cliente quer tentar novamente.",
    };
  }

  logger.info(SCOPE, "Criando agendamento", { conversationId: ctx.conversation.id, name, procedure, selectedStart });
  try {
    await schedulingService.createAppointment({
      userId: ctx.user.id,
      name,
      phone: ctx.user.phone,
      service: procedure,
      start: selectedStart,
      durationMinutes,
    });
    logger.info(SCOPE, "Agendamento criado com sucesso", { conversationId: ctx.conversation.id });

    return {
      nextStep: "MENU",
      data: {},
      message: `Agendamento confirmado! 😊\n\n${procedure} em ${formatDate(selectedStart)} às ${formatTime(selectedStart)}.\nEndereço: ${CLINIC_ADDRESS}\n\nPosso ajudar com mais alguma coisa?`,
    };
  } catch (err: any) {
    logger.error(SCOPE, "Falha ao criar agendamento", err);
    return {
      nextStep: "SCHEDULING_CONFIRM",
      data: ctx.conversation.state_data,
      message: `Desculpe, tive um problema técnico ao confirmar o agendamento (${err.message}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.`,
    };
  }
}

export const confirmStep: StepDefinition = {
  id: "SCHEDULING_CONFIRM",
  instructions: (ctx) => {
    const { name, procedure, selectedStart } = ctx.conversation.state_data;
    return (
      `Etapa: aguardando confirmacao final. Dados: nome=${name}, procedimento=${procedure}, horario=${selectedStart}. ` +
      "Repita esses dados e peça confirmação explícita. Se o cliente ja confirmou claramente, chame confirm_scheduling. Nunca chame sem confirmacao explicita."
    );
  },
  tools: [
    {
      name: "confirm_scheduling",
      description: "Confirma e cria o agendamento (Google Calendar + Supabase). Só chamar apos confirmacao explicita do cliente.",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_scheduling: async (ctx) => confirmScheduling(ctx),
    abandon_flow: abandonFlow,
  },
};

export const schedulingSteps: StepDefinition[] = [procedureStep, nameStep, dateStep, timeStep, confirmStep];
