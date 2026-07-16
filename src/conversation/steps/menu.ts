import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import { logger } from "../../utils/logger";
import { clinicInfoText } from "../prompt";
import { FlowContext, StepDefinition } from "../types";
import { looksLikeFullName } from "./shared";
import { SWITCH_HANDLERS, SWITCH_TOOLS } from "./switchFlow";

const SCOPE = "conversation.menu";

export const menuStep: StepDefinition = {
  id: "MENU",
  instructions: async (ctx: FlowContext) => {
    let text =
      "Voce e a recepcionista virtual da clinica atendendo pelo WhatsApp. Converse de forma natural, leve e acolhedora, " +
      "como uma recepcionista experiente conversaria - NUNCA como um chatbot. Interprete a intencao do cliente livremente, " +
      "sem depender de menus numerados ou de uma sequencia fixa de perguntas. Use as informacoes da clinica abaixo para " +
      "tirar duvidas (endereco, horario, FAQ, procedimentos) diretamente, sem precisar de cadastro para isso.\n" +
      "REGRA CRITICA: assim que perceber QUALQUER sinal de que o cliente quer agendar, remarcar ou cancelar " +
      '(ex: "quero agendar um horario", "quero marcar Botox", "preciso remarcar"), chame IMEDIATAMENTE ' +
      "begin_scheduling, begin_rescheduling ou begin_cancellation NA MESMA RESPOSTA - mesmo que ainda nao saiba " +
      "o procedimento, nome ou data. NUNCA faca perguntas de esclarecimento ou peça confirmação em texto livre " +
      "antes de chamar essa ferramenta - e a propria ferramenta e as etapas seguintes que vao conduzir as " +
      "perguntas, uma de cada vez. A intencao de agendar tem prioridade sobre explicar o procedimento ou " +
      "informar preco: se o cliente disser \"quero agendar Botox\", va direto para o agendamento. E essas ferramentas " +
      "que vao pedir o cadastro (nome) quando for realmente necessario - nao peça nome so por causa de uma pergunta solta.\n" +
      "Depois de responder uma duvida (ex: sobre um procedimento), pode convidar naturalmente para uma avaliacao, sem forcar.\n";

    const hasName = looksLikeFullName(ctx.user.name);

    if (ctx.isFirstMessage) {
      if (hasName) {
        text +=
          `Este cliente ja e cadastrado (nome: ${ctx.user.name}) e esta retomando o atendimento. Cumprimente-o pelo nome de forma calorosa ` +
          '(ex: "Olá novamente, ' + ctx.user.name.split(" ")[0] + '! 😊 Que bom falar com você outra vez. Como posso ajudar hoje?"), sem perguntar o nome de novo.\n';
      } else {
        const welcomeGuidance = await aiKnowledgeService.getMessageTemplate("welcome_message");
        text += `Este e o primeiro contato deste numero. Orientacao de tom para a saudacao: ${welcomeGuidance}\n`;
      }
    }

    return text + "\n\n---\n\n" + (await clinicInfoText());
  },
  tools: [
    ...SWITCH_TOOLS,
    {
      name: "request_human_handoff",
      description: "Encerra o atendimento automatico e sinaliza que um atendente humano deve continuar a conversa.",
      input_schema: { type: "object", properties: { reason: { type: "string", description: "Motivo do encaminhamento" } }, required: ["reason"] },
    },
  ],
  handlers: {
    ...SWITCH_HANDLERS,
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
