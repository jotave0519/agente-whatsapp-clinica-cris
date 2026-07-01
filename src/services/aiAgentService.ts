import fs from "fs";
import path from "path";
import { createMessage } from "../integrations/anthropicClient";
import { env } from "../config/env";
import * as schedulingService from "./schedulingService";
import * as flow from "./conversationFlowService";
import * as conversationRepository from "../repositories/conversationRepository";
import { Conversation, ConversationFlowState, User } from "../types";
import { logger } from "../utils/logger";

const WORKFLOWS_DIR = path.join(__dirname, "..", "..", "workflows");

function loadWorkflowsText(): string {
  const files = ["atendimento_faq.md", "agendamento_consultas.md"];
  return files.map((file) => fs.readFileSync(path.join(WORKFLOWS_DIR, file), "utf-8")).join("\n\n---\n\n");
}

const WORKFLOWS_TEXT = loadWorkflowsText();

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

function describeSlots(slots?: string[]): string {
  return (slots || []).map((s, i) => `${i + 1}) ${formatTime(s)}`).join("  ");
}

function describeCandidatesForPrompt(candidates?: { procedure: string; date: string; time: string }[]): string {
  return (candidates || []).map((c, i) => `${i + 1}) ${c.procedure} em ${c.date} as ${c.time}`).join("  ");
}

const BASE_RULES =
  "Voce e o assistente de WhatsApp da clinica da Dra. Cristiane Zangelmi. " +
  "Responda sempre em portugues do Brasil, em mensagens curtas e naturais de WhatsApp (evite paredes de texto).\n" +
  "REGRA CRITICA: faca APENAS UMA pergunta por mensagem, nunca duas ou mais juntas.\n" +
  "REGRA CRITICA: nunca invente horarios - use somente os que vierem do resultado de uma ferramenta.\n" +
  "REGRA CRITICA: nunca diga que agendar/remarcar/cancelar foi concluido sem que a ferramenta correspondente tenha retornado sucesso.\n" +
  "REGRA CRITICA: nunca informe precos/valores de procedimentos por conta propria - apenas quando o cliente perguntar explicitamente (ex: \"quanto custa\", \"qual o valor\").\n";

function buildSystemPrompt(conversation: Conversation, isFirstMessage: boolean): string {
  const { state, state_data: stateData } = conversation;
  const today = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  let header = BASE_RULES + `Data e hora atual: ${today} (America/Sao_Paulo).\n`;

  if (state === "MENU") {
    header +=
      "Voce esta no atendimento geral. Use os workflows abaixo para tirar duvidas sobre a clinica.\n" +
      "REGRA CRITICA: assim que voce perceber QUALQUER sinal de que o cliente quer agendar, remarcar ou cancelar " +
      "(ex: \"quero agendar um horario\", \"quero marcar Botox\", \"preciso remarcar\"), chame IMEDIATAMENTE " +
      "begin_scheduling, begin_rescheduling ou begin_cancellation NA MESMA RESPOSTA - mesmo que ainda nao saiba " +
      "o procedimento, nome ou data. NUNCA faca perguntas de esclarecimento ou peça confirmacao em texto livre " +
      "antes de chamar essa ferramenta (ex: nunca responda so com \"Gostaria de agendar uma avaliacao para Botox?\" " +
      "sem chamar a ferramenta) - e a propria ferramenta e as etapas seguintes que vao conduzir as perguntas, uma de cada vez. " +
      "A intencao de agendar tem prioridade sobre explicar o procedimento ou informar preco: se o cliente disser " +
      "\"quero agendar Botox\", va direto para o agendamento, nao explique o que e Botox nem quanto custa.\n";
    if (isFirstMessage) {
      header +=
        "Esta e a primeira mensagem deste cliente na conversa: cumprimente-o pelo nome (se souber) e apresente " +
        "as opcoes principais (1. Agendar avaliacao, 2. Remarcar agendamento, 3. Cancelar agendamento, " +
        "4. Conhecer nossos tratamentos, 5. Falar com um atendente), mas tambem entenda linguagem natural livremente.\n";
    }
    return header + "\n\n---\n\n" + WORKFLOWS_TEXT;
  }

  header +=
    "\nVoce esta no meio de um atendimento de agendamento/remarcacao/cancelamento EM ANDAMENTO. " +
    "E PROIBIDO voltar ao menu principal, listar as opcoes novamente, ou mudar de assunto antes de concluir esta operacao. " +
    "Se o cliente pedir claramente para parar ou desistir deste fluxo, chame abandon_flow. Fora isso, siga apenas a etapa atual abaixo:\n\n";

  switch (state) {
    case "SCHEDULING_PROCEDURE":
      header +=
        "Etapa: falta saber qual procedimento o cliente quer agendar. Se a ultima mensagem ja contem o procedimento " +
        "(ex: Botox, preenchimento, limpeza de pele, avaliacao), chame provide_procedure com esse valor. " +
        "Caso contrario, pergunte (apenas) qual procedimento ele deseja agendar. Nao explique o procedimento nem informe preco aqui.";
      break;
    case "SCHEDULING_NAME":
      header +=
        "Etapa: falta o nome completo do paciente. Se a ultima mensagem do cliente ja contem o nome, chame provide_name. " +
        "Caso contrario, pergunte (apenas) o nome completo.";
      break;
    case "SCHEDULING_DATE":
      header +=
        `Etapa: falta a data desejada (procedimento: ${stateData.procedure || "avaliacao"}` +
        `${stateData.name ? `, paciente: ${stateData.name}` : ""}). Se a ultima mensagem ja contem uma data, ` +
        "chame provide_date com a data no formato YYYY-MM-DD (resolva termos relativos como \"amanha\"/\"segunda\" usando a data atual acima). " +
        "Caso contrario, pergunte (apenas) a data desejada.";
      break;
    case "SCHEDULING_TIME":
      header +=
        `Etapa: falta escolher o horario. Opcoes disponiveis (ja consultadas no Google Calendar): ${describeSlots(stateData.availableSlots)}. ` +
        "Apresente essas opcoes numeradas ao cliente (formato HH:MM) e pergunte qual ele prefere. " +
        "Se o cliente ja escolheu (por numero, horario ou descricao como \"o das 10h\"), chame select_time com o NUMERO da opcao (index, comecando em 1).";
      break;
    case "SCHEDULING_CONFIRM":
      header +=
        `Etapa: aguardando confirmacao final. Dados: nome=${stateData.name}, procedimento=${stateData.procedure}, horario=${stateData.selectedStart}. ` +
        "Repita esses dados e peca confirmacao explicita. Se o cliente ja confirmou claramente, chame confirm_scheduling. Nunca chame sem confirmacao explicita.";
      break;
    case "RESCHEDULING_SELECT":
      header +=
        `Etapa: o cliente tem varios agendamentos ativos: ${describeCandidatesForPrompt(stateData.candidates)}. ` +
        "Liste-os numerados e pergunte qual ele quer remarcar. Se ja escolheu, chame select_appointment_to_reschedule com o NUMERO da opcao (index, comecando em 1).";
      break;
    case "RESCHEDULING_DATE":
      header +=
        `Etapa: falta a nova data desejada para remarcar (procedimento: ${stateData.procedure}). Se a mensagem ja contem uma data, ` +
        "chame provide_reschedule_date com a data no formato YYYY-MM-DD. Caso contrario, pergunte (apenas) a nova data.";
      break;
    case "RESCHEDULING_TIME":
      header +=
        `Etapa: falta escolher o novo horario. Opcoes disponiveis: ${describeSlots(stateData.availableSlots)}. ` +
        "Apresente-as numeradas e pergunte qual prefere. Se ja escolheu, chame select_reschedule_time com o NUMERO da opcao (index, comecando em 1).";
      break;
    case "RESCHEDULING_CONFIRM":
      header +=
        `Etapa: aguardando confirmacao final da remarcacao para ${stateData.selectedStart}. Peca confirmacao explicita. ` +
        "Se ja confirmou, chame confirm_rescheduling.";
      break;
    case "CANCELING_SELECT":
      header +=
        `Etapa: o cliente tem varios agendamentos ativos: ${describeCandidatesForPrompt(stateData.candidates)}. ` +
        "Liste-os numerados e pergunte qual ele quer cancelar. Se ja escolheu, chame select_appointment_to_cancel com o NUMERO da opcao (index, comecando em 1).";
      break;
    case "CANCELING_CONFIRM":
      header +=
        `Etapa: aguardando confirmacao final do cancelamento de ${stateData.procedure} em ${stateData.date}. ` +
        "Peca confirmacao explicita. Se ja confirmou, chame confirm_cancellation.";
      break;
  }

  return header;
}

const ABANDON_TOOL = {
  name: "abandon_flow",
  description: "Aborta o fluxo atual de agendamento/remarcacao/cancelamento e volta ao atendimento geral, a pedido explicito do cliente.",
  input_schema: { type: "object", properties: {} },
};

const MENU_TOOLS: any[] = [
  {
    name: "begin_scheduling",
    description:
      "Inicia o fluxo de agendamento. Chame IMEDIATAMENTE ao perceber que o cliente quer agendar algo, mesmo sem " +
      "saber ainda o procedimento, nome ou data - esses dados serao perguntados nas proximas etapas se nao informados aqui.",
    input_schema: {
      type: "object",
      properties: {
        procedure: { type: "string", description: "Procedimento de interesse, se ja mencionado nesta mensagem (ex: Botox, avaliacao)" },
        name: { type: "string", description: "Nome completo do paciente, se ja informado nesta mensagem" },
        date: { type: "string", description: "Data desejada (YYYY-MM-DD), se ja informada nesta mensagem" },
      },
      required: [],
    },
  },
  {
    name: "begin_rescheduling",
    description: "Inicia o fluxo de remarcacao de um agendamento existente do cliente atual.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "begin_cancellation",
    description: "Inicia o fluxo de cancelamento de um agendamento existente do cliente atual.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "confirm_appointment",
    description: "Marca um agendamento como confirmado pelo paciente (ex: em resposta a um lembrete de consulta).",
    input_schema: {
      type: "object",
      properties: { schedule_id: { type: "string" } },
      required: ["schedule_id"],
    },
  },
  {
    name: "request_human_handoff",
    description: "Encerra o atendimento automatico e sinaliza que um atendente humano deve continuar a conversa.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "Motivo do encaminhamento" } },
      required: ["reason"],
    },
  },
];

const STATE_TOOLS: Partial<Record<ConversationFlowState, any[]>> = {
  SCHEDULING_PROCEDURE: [
    {
      name: "provide_procedure",
      description: "Registra o procedimento que o cliente quer agendar.",
      input_schema: { type: "object", properties: { procedure: { type: "string" } }, required: ["procedure"] },
    },
    ABANDON_TOOL,
  ],
  SCHEDULING_NAME: [
    {
      name: "provide_name",
      description: "Registra o nome completo do paciente informado pelo cliente.",
      input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
    ABANDON_TOOL,
  ],
  SCHEDULING_DATE: [
    {
      name: "provide_date",
      description: "Registra a data desejada e consulta a disponibilidade real no Google Calendar.",
      input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] },
    },
    ABANDON_TOOL,
  ],
  SCHEDULING_TIME: [
    {
      name: "select_time",
      description: "Registra o horario escolhido pelo cliente, pelo numero da opcao apresentada (1, 2, 3...).",
      input_schema: { type: "object", properties: { index: { type: "integer", description: "Numero da opcao escolhida, comecando em 1" } }, required: ["index"] },
    },
    ABANDON_TOOL,
  ],
  SCHEDULING_CONFIRM: [
    {
      name: "confirm_scheduling",
      description: "Confirma e cria o agendamento (Google Calendar + Supabase). Só chamar apos confirmacao explicita do cliente.",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
  RESCHEDULING_SELECT: [
    {
      name: "select_appointment_to_reschedule",
      description: "Seleciona qual agendamento existente o cliente quer remarcar, pelo numero da opcao apresentada (1, 2, 3...).",
      input_schema: { type: "object", properties: { index: { type: "integer", description: "Numero da opcao escolhida, comecando em 1" } }, required: ["index"] },
    },
    ABANDON_TOOL,
  ],
  RESCHEDULING_DATE: [
    {
      name: "provide_reschedule_date",
      description: "Registra a nova data desejada e consulta a disponibilidade real no Google Calendar.",
      input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] },
    },
    ABANDON_TOOL,
  ],
  RESCHEDULING_TIME: [
    {
      name: "select_reschedule_time",
      description: "Registra o novo horario escolhido pelo cliente, pelo numero da opcao apresentada (1, 2, 3...).",
      input_schema: { type: "object", properties: { index: { type: "integer", description: "Numero da opcao escolhida, comecando em 1" } }, required: ["index"] },
    },
    ABANDON_TOOL,
  ],
  RESCHEDULING_CONFIRM: [
    {
      name: "confirm_rescheduling",
      description: "Confirma e aplica a remarcacao (Google Calendar + Supabase). Só chamar apos confirmacao explicita do cliente.",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
  CANCELING_SELECT: [
    {
      name: "select_appointment_to_cancel",
      description: "Seleciona qual agendamento existente o cliente quer cancelar, pelo numero da opcao apresentada (1, 2, 3...).",
      input_schema: { type: "object", properties: { index: { type: "integer", description: "Numero da opcao escolhida, comecando em 1" } }, required: ["index"] },
    },
    ABANDON_TOOL,
  ],
  CANCELING_CONFIRM: [
    {
      name: "confirm_cancellation",
      description: "Confirma e executa o cancelamento (Google Calendar + Supabase). Só chamar apos confirmacao explicita do cliente.",
      input_schema: { type: "object", properties: {} },
    },
    ABANDON_TOOL,
  ],
};

function buildToolsForState(state: ConversationFlowState): any[] {
  return state === "MENU" ? MENU_TOOLS : STATE_TOOLS[state] || [ABANDON_TOOL];
}

async function executeTool(
  name: string,
  input: any,
  user: User,
  conversation: Conversation
): Promise<{ output: string; conversation: Conversation; handoffRequested?: boolean }> {
  try {
    switch (name) {
      case "begin_scheduling": {
        const result = await flow.beginScheduling(conversation, input);
        return applyResult(result, conversation);
      }
      case "provide_procedure": {
        const result = await flow.provideProcedure(conversation, input.procedure);
        return applyResult(result, conversation);
      }
      case "provide_name": {
        const result = await flow.provideName(conversation, input.name);
        return applyResult(result, conversation);
      }
      case "provide_date": {
        const result = await flow.provideDate(conversation, input.date);
        return applyResult(result, conversation);
      }
      case "select_time": {
        const result = await flow.selectTime(conversation, Number(input.index));
        return applyResult(result, conversation);
      }
      case "confirm_scheduling": {
        const result = await flow.confirmScheduling(user, conversation);
        return applyResult(result, conversation);
      }
      case "begin_rescheduling": {
        const result = await flow.beginRescheduling(user, conversation);
        return applyResult(result, conversation);
      }
      case "select_appointment_to_reschedule": {
        const result = await flow.selectAppointmentToReschedule(conversation, Number(input.index));
        return applyResult(result, conversation);
      }
      case "provide_reschedule_date": {
        const result = await flow.provideRescheduleDate(conversation, input.date);
        return applyResult(result, conversation);
      }
      case "select_reschedule_time": {
        const result = await flow.selectTime(conversation, Number(input.index));
        return applyResult(result, conversation);
      }
      case "confirm_rescheduling": {
        const result = await flow.confirmRescheduling(conversation);
        return applyResult(result, conversation);
      }
      case "begin_cancellation": {
        const result = await flow.beginCancellation(user, conversation);
        return applyResult(result, conversation);
      }
      case "select_appointment_to_cancel": {
        const result = await flow.selectAppointmentToCancel(conversation, Number(input.index));
        return applyResult(result, conversation);
      }
      case "confirm_cancellation": {
        const result = await flow.confirmCancellation(conversation);
        return applyResult(result, conversation);
      }
      case "abandon_flow": {
        const result = await flow.abandonFlow(conversation);
        return applyResult(result, conversation);
      }
      case "confirm_appointment": {
        await schedulingService.confirmAppointment(input.schedule_id);
        return { output: JSON.stringify({ status: "confirmed" }), conversation };
      }
      case "request_human_handoff": {
        return {
          output: JSON.stringify({ status: "handoff_requested", reason: input.reason }),
          conversation,
          handoffRequested: true,
        };
      }
      default:
        return { output: JSON.stringify({ error: `Ferramenta desconhecida: ${name}` }), conversation };
    }
  } catch (err: any) {
    logger.error("aiAgentService.executeTool", `Excecao ao executar ferramenta ${name}`, err);
    return { output: `Erro ao executar ${name}: ${err.message}`, conversation };
  }
}

function applyResult(
  result: flow.FlowResult,
  conversation: Conversation
): { output: string; conversation: Conversation } {
  const updated: Conversation = { ...conversation, state: result.state, state_data: result.stateData };
  return { output: result.message, conversation: updated };
}

export interface AgentResult {
  reply: string;
  handoffRequested: boolean;
}

const SCOPE = "aiAgentService";

export async function handleMessage(user: User, conversation: Conversation, userMessage: string): Promise<AgentResult> {
  logger.info(SCOPE, "handleMessage: inicio", {
    userId: user.id,
    conversationId: conversation.id,
    state: conversation.state,
    userMessage,
  });

  const priorMessages = await conversationRepository.listMessages(conversation.id);
  const isFirstMessage = priorMessages.length === 0;

  await conversationRepository.addMessage(conversation.id, "user", userMessage);

  // Fast-path deterministico: se o estado atual e uma confirmacao pendente e o texto
  // do cliente e uma afirmacao clara, executa a acao direto, sem passar pelo LLM.
  if (flow.isConfirmState(conversation.state) && flow.isConfirmationText(userMessage)) {
    logger.info(SCOPE, "Fast-path de confirmacao acionado", { conversationId: conversation.id, state: conversation.state });
    const result = await flow.executePendingConfirmation(user, conversation);
    logger.info(SCOPE, "Fast-path de confirmacao concluido", { novoEstado: result.state, mensagem: result.message });
    await conversationRepository.addMessage(conversation.id, "assistant", result.message);
    return { reply: result.message, handoffRequested: false };
  }

  if (conversation.state !== "MENU" && flow.isAbandonText(userMessage)) {
    logger.info(SCOPE, "Fast-path de abandono de fluxo acionado", { conversationId: conversation.id, state: conversation.state });
    const result = await flow.abandonFlow(conversation);
    await conversationRepository.addMessage(conversation.id, "assistant", result.message);
    return { reply: result.message, handoffRequested: false };
  }

  let currentConversation = conversation;
  const history: any[] = priorMessages.map((m) => ({ role: m.role, content: m.content }));
  history.push({ role: "user", content: userMessage });

  let handoffRequested = false;

  try {
    let iteration = 0;
    while (true) {
      iteration += 1;
      const systemPrompt = buildSystemPrompt(currentConversation, isFirstMessage);
      const tools = buildToolsForState(currentConversation.state);
      logger.info(SCOPE, `Chamando Claude (iteracao ${iteration})`, {
        state: currentConversation.state,
        toolNames: tools.map((t: any) => t.name),
        historyLength: history.length,
      });

      const response = await createMessage({
        model: env.anthropicModel,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: history,
      });

      logger.info(SCOPE, `Resposta da Claude (iteracao ${iteration})`, {
        stopReason: response.stop_reason,
        blocks: response.content.map((b) => (b.type === "tool_use" ? { type: "tool_use", name: b.name, input: b.input } : { type: "text" })),
      });

      if (response.stop_reason === "tool_use") {
        history.push({ role: "assistant", content: response.content });

        const toolResults = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            logger.info(SCOPE, "Executando ferramenta", { name: block.name, input: block.input, state: currentConversation.state });
            const { output, conversation: updatedConversation, handoffRequested: handoff } = await executeTool(
              block.name!,
              block.input,
              user,
              currentConversation
            );
            logger.info(SCOPE, "Resultado da ferramenta", {
              name: block.name,
              output,
              novoEstado: updatedConversation.state,
            });
            currentConversation = updatedConversation;
            if (handoff) handoffRequested = true;
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output });
          }
        }
        history.push({ role: "user", content: toolResults });
        continue;
      }

      const finalText = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      logger.info(SCOPE, "handleMessage: resposta final", { conversationId: conversation.id, finalText, handoffRequested });

      await conversationRepository.addMessage(conversation.id, "assistant", finalText);

      if (handoffRequested) {
        await conversationRepository.updateConversationStatus(conversation.id, "human");
      }

      return { reply: finalText, handoffRequested };
    }
  } catch (err) {
    logger.error(SCOPE, "handleMessage: excecao no loop de conversa com a Claude", err);
    throw err;
  }
}
