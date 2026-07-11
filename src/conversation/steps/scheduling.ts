import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as schedulingService from "../../services/schedulingService";
import * as settingsRepository from "../../repositories/settingsRepository";
import * as userRepository from "../../repositories/userRepository";
import { FlowStateData } from "../../types";
import { logger } from "../../utils/logger";
import { describeSlots, formatDate, formatTime } from "../prompt";
import { FlowContext, StepDefinition, StepResult, ToolHandler } from "../types";
import { ABANDON_TOOL, abandonFlow, looksLikeFullName, sampleSlotsAcrossDay } from "./shared";

const SCOPE = "conversation.scheduling";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Consulta disponibilidade real no Google Calendar para a data informada.
 * Usada tanto pela etapa SCHEDULING_DATE quanto por begin_scheduling quando
 * o cliente ja informa a data na mesma mensagem que inicia o fluxo.
 *
 * Valida o formato da data ANTES de consultar o Calendar: se o modelo nao
 * resolveu corretamente uma expressao como "segunda" para uma data ISO, isso
 * evita um erro tecnico (Invalid time value) vazando para o tool_result -
 * devolve uma instrucao para o proprio modelo corrigir, sem tocar a API.
 */
export async function provideDate(ctx: FlowContext, baseData: FlowStateData, date: string): Promise<StepResult> {
  if (!ISO_DATE.test(date) || isNaN(Date.parse(date))) {
    logger.warn(SCOPE, "Data invalida recebida do modelo, nao consultando o Calendar", { conversationId: ctx.conversation.id, date });
    return {
      nextStep: "SCHEDULING_DATE",
      data: baseData,
      message:
        `A data "${date}" nao esta num formato valido (YYYY-MM-DD). Resolva a data que o cliente quis dizer usando a data ` +
        "atual e o dia da semana informados no topo destas instrucoes, e chame provide_date novamente com o formato correto. " +
        "Nao mencione esse erro ao cliente.",
    };
  }

  const durationMinutes = baseData.durationMinutes ?? 30;
  logger.info(SCOPE, "Consultando disponibilidade", { conversationId: ctx.conversation.id, date, durationMinutes });
  const slots = await schedulingService.checkAvailability(date, durationMinutes);
  logger.info(SCOPE, "Disponibilidade recebida", { date, slotCount: slots.length });

  if (slots.length === 0) {
    const alternative = await schedulingService.findNextAvailable(date, durationMinutes);
    if (alternative) {
      logger.info(SCOPE, "Sugerindo data alternativa", { requestedDate: date, alternativeDate: alternative.date });
      return {
        nextStep: "SCHEDULING_DATE",
        data: baseData,
        message:
          `Nenhum horario livre em ${date}. Porem ha disponibilidade em ${alternative.date}: ${describeSlots(alternative.slots)}. ` +
          "Informe ao cliente que a data pedida esta cheia e ofereca essa data alternativa com os horarios (formato HH:MM), perguntando se algum serve. " +
          "Se o cliente aceitar um desses horarios, chame provide_date de novo com a data alternativa para registrar oficialmente e seguir para a escolha do horario. " +
          "Se em vez disso o cliente pedir OUTRA data diferente (a que voce sugeriu ou a original), IGNORE completamente essa sugestao e chame provide_date " +
          "com a nova data que ele pediu - nunca insista ou volte a mencionar uma data que o cliente nao escolheu.",
      };
    }
    const guidance = await aiKnowledgeService.getMessageTemplate("no_slot_found");
    return {
      nextStep: "SCHEDULING_DATE",
      data: baseData,
      message: `Nenhum horario livre em ${date} nem nos proximos dias. ${guidance}`,
    };
  }

  const data: FlowStateData = { ...baseData, date, availableSlots: sampleSlotsAcrossDay(slots) };
  return {
    nextStep: "SCHEDULING_TIME",
    data,
    message: `Horarios disponiveis em ${date}: ${describeSlots(data.availableSlots)}. Apresente essas opcoes numeradas (formato HH:MM) e pergunte qual o cliente prefere.`,
  };
}

/**
 * Inicia (ou reinicia, no caso de troca de fluxo em outra etapa) o fluxo de
 * agendamento. O cadastro do paciente (nome) vem ANTES do procedimento -
 * reflete como uma recepcionista de verdade conduziria: primeiro sabe quem e
 * a pessoa, depois o que ela quer. Reaproveita o nome ja cadastrado
 * (ctx.user.name) quando ele parece completo, para nao perguntar de novo.
 */
export const beginScheduling: ToolHandler = async (ctx, input) => {
  const data: FlowStateData = {};
  if (input.procedure) data.procedure = input.procedure;
  if (input.name) data.name = input.name;
  logger.info(SCOPE, "Iniciando fluxo de agendamento", { conversationId: ctx.conversation.id, input });

  if (data.procedure) {
    const duration = await aiKnowledgeService.findProcedureDuration(data.procedure);
    if (duration) data.durationMinutes = duration;
  }

  if (!data.name && looksLikeFullName(ctx.user.name)) {
    data.name = ctx.user.name;
    logger.info(SCOPE, "Nome ja cadastrado reaproveitado", { conversationId: ctx.conversation.id, name: ctx.user.name });
  }

  if (!data.name) {
    return {
      nextStep: "SCHEDULING_NAME",
      data,
      message: "Fluxo de agendamento iniciado. Peça o nome completo do paciente para realizar o cadastro (explique rapidamente o motivo).",
    };
  }

  if (!data.procedure) {
    return { nextStep: "SCHEDULING_PROCEDURE", data, message: `Nome já conhecido (${data.name}), não precisa perguntar de novo. Pergunte qual procedimento o cliente deseja, ou se prefere uma avaliação.` };
  }
  if (input.date) {
    return provideDate(ctx, data, input.date);
  }
  return { nextStep: "SCHEDULING_DATE", data, message: `Procedimento registrado: ${data.procedure}. Nome já conhecido (${data.name}), não precisa perguntar de novo. Peça a data desejada.` };
};

export const procedureStep: StepDefinition = {
  id: "SCHEDULING_PROCEDURE",
  instructions: (ctx) =>
    `Etapa: falta saber qual procedimento o paciente (${ctx.conversation.state_data.name}) quer agendar. Se a ultima mensagem ja contem o procedimento ` +
    "(ex: Botox, preenchimento, limpeza de pele) ou uma preferencia por avaliacao, chame provide_procedure com esse valor. Caso contrario, pergunte algo como " +
    '"Você já sabe qual procedimento deseja realizar ou prefere agendar uma avaliação para a Dra. indicar o tratamento mais adequado?". ' +
    "Nao explique o procedimento nem informe preco aqui.",
  tools: [
    {
      name: "provide_procedure",
      description: "Registra o procedimento (ou 'avaliacao') que o cliente quer agendar.",
      input_schema: { type: "object", properties: { procedure: { type: "string" } }, required: ["procedure"] },
    },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_procedure: async (ctx, input) => {
      const data: FlowStateData = { ...ctx.conversation.state_data, procedure: input.procedure };
      const duration = await aiKnowledgeService.findProcedureDuration(input.procedure);
      if (duration) data.durationMinutes = duration;
      logger.info(SCOPE, "Procedimento registrado", { conversationId: ctx.conversation.id, procedure: input.procedure, durationMinutes: data.durationMinutes });
      return { nextStep: "SCHEDULING_DATE", data, message: `Procedimento registrado: ${input.procedure}. Peça a data desejada.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const nameStep: StepDefinition = {
  id: "SCHEDULING_NAME",
  instructions: () =>
    "Etapa: falta o nome completo do paciente para o cadastro. Se a ultima mensagem ja contem o nome, chame provide_name. Caso contrario, " +
    'pergunte de forma natural, explicando o motivo - ex: "Antes de continuarmos, poderia me informar seu nome completo para realizar seu cadastro? 😊".',
  tools: [
    {
      name: "provide_name",
      description: "Registra o nome completo do paciente informado pelo cliente e salva no cadastro.",
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

      await userRepository.updatePatient(ctx.user.id, { name: input.name });
      logger.info(SCOPE, "Nome registrado e persistido no cadastro", { conversationId: ctx.conversation.id, userId: ctx.user.id, name: input.name });

      const data: FlowStateData = { ...ctx.conversation.state_data, name: input.name };
      if (data.procedure) {
        return { nextStep: "SCHEDULING_DATE", data, message: `Nome registrado: ${input.name}. Procedimento já conhecido (${data.procedure}), não precisa perguntar de novo. Peça a data desejada.` };
      }
      return {
        nextStep: "SCHEDULING_PROCEDURE",
        data,
        message: `Nome registrado: ${input.name}. Pergunte se já sabe qual procedimento deseja ou prefere agendar uma avaliação.`,
      };
    },
    abandon_flow: abandonFlow,
  },
};

export const dateStep: StepDefinition = {
  id: "SCHEDULING_DATE",
  instructions: (ctx) => {
    const { procedure, name } = ctx.conversation.state_data;
    return (
      `Etapa: falta a data desejada (procedimento: ${procedure}, paciente: ${name}). Se a ultima mensagem ja contem QUALQUER referencia temporal ` +
      '- "hoje", "amanha", "depois de amanha", nome de dia da semana ("segunda", "quarta-feira", "sabado", "domingo"), "proxima sexta", ' +
      '"semana que vem", "inicio/fim da semana" etc - resolva mentalmente para uma data exata usando a data atual e o dia da semana informados ' +
      "no topo destas instrucoes (dia da semana sozinho = a proxima ocorrencia desse dia a partir de hoje, mesmo que seja o mesmo dia da semana " +
      "de hoje - nesse caso e o dia da semana que vem) e chame provide_date DIRETO com o resultado no formato YYYY-MM-DD. " +
      'NUNCA responda coisas como "pode confirmar a data?", "digite no formato DD/MM", "não consegui entender" ou "pode repetir a data?" quando ' +
      "o cliente ja disse um dia da semana ou termo relativo claro - isso so deve ser perguntado se a mensagem realmente nao contiver nenhuma " +
      "referencia de data. SEMPRE priorize a informacao mais recente do cliente: se voce ja sugeriu ou consultou uma data antes nesta conversa e " +
      "o cliente agora mencionar uma data ou dia da semana DIFERENTE, esqueca completamente a data anterior (sugerida ou pedida) e chame " +
      "provide_date com a nova data - nunca insista ou volte a oferecer a data anterior."
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
    "escolheu (por numero, horario ou descricao como \"o das 10h\"), chame select_time com o NUMERO da opcao (index, comecando em 1). " +
    "Se em vez de escolher um horario o cliente mudar de ideia e pedir OUTRA data/dia da semana diferente, esqueca as opcoes atuais e chame " +
    "provide_date com a nova data resolvida (mesma logica de resolucao de data das outras etapas).",
  tools: [
    {
      name: "select_time",
      description: "Registra o horario escolhido pelo cliente, pelo numero da opcao apresentada (1, 2, 3...).",
      input_schema: { type: "object", properties: { index: { type: "integer", description: "Numero da opcao escolhida, comecando em 1" } }, required: ["index"] },
    },
    {
      name: "provide_date",
      description: "Usado quando o cliente muda de ideia sobre a data enquanto escolhia o horario - registra a nova data e consulta a disponibilidade real.",
      input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] },
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
    provide_date: async (ctx, input) => provideDate(ctx, ctx.conversation.state_data, input.date),
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

    const settings = await settingsRepository.getClinicSettings();
    const message = await aiKnowledgeService.getMessageTemplate("confirm_scheduling_success", {
      procedure,
      date: formatDate(selectedStart),
      time: formatTime(selectedStart),
      address: settings.address || "",
    });
    return { nextStep: "MENU", data: {}, message };
  } catch (err: any) {
    logger.error(SCOPE, "Falha ao criar agendamento", err);
    const message = await aiKnowledgeService.getMessageTemplate("confirm_scheduling_failure", { error: err.message });
    return { nextStep: "SCHEDULING_CONFIRM", data: ctx.conversation.state_data, message };
  }
}

export const confirmStep: StepDefinition = {
  id: "SCHEDULING_CONFIRM",
  instructions: async (ctx) => {
    const { name, procedure, selectedStart } = ctx.conversation.state_data;
    const settings = await settingsRepository.getClinicSettings();
    return (
      `Etapa: aguardando confirmacao final. Dados: nome=${name}, procedimento=${procedure}, horario=${selectedStart ? `${formatDate(selectedStart)} as ${formatTime(selectedStart)}` : selectedStart}, ` +
      `local=${settings.name}${settings.address ? `, ${settings.address}` : ""}. Monte um resumo nesse formato antes de pedir confirmação (adapte o texto ao redor, mas mantenha os emojis e a estrutura):\n` +
      `📅 [dia da semana, data]\n🕒 [horario]\n👤 [nome do paciente]\n📍 [nome da clinica e endereco]\n\n` +
      'Pergunte algo como "Posso confirmar esse horário?" logo depois. Se o cliente ja confirmou claramente, chame confirm_scheduling. Nunca chame sem confirmacao explicita.'
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
