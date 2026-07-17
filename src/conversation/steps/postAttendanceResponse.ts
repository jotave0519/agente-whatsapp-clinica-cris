import * as conversationRepository from "../../repositories/conversationRepository";
import * as aiKnowledgeService from "../../services/aiKnowledgeService";
import * as postAttendanceEngine from "../../services/postAttendanceEngine";
import { logger } from "../../utils/logger";
import { StepDefinition } from "../types";
import { ABANDON_TOOL, FLAG_OPPORTUNITY_TOOL, HUMAN_HANDOFF_TOOL, abandonFlow, flagOpportunity, requestHumanHandoff } from "./shared";

const SCOPE = "conversation.postAttendanceResponse";

/**
 * Etapa em que a conversa entra logo apos o motor de pos-atendimento
 * (src/services/postAttendanceEngine.ts) enviar uma mensagem de acompanhamento
 * (check-in, pergunta, pedido de avaliacao ou lembrete de retorno) apos uma
 * consulta concluida. Sensivel por natureza (pode ser o unico canal em que um
 * paciente relata uma possivel complicacao) - por isso flag_concern tem
 * prioridade absoluta sobre qualquer outra interpretacao da resposta.
 *
 * Cancelamento/remarcacao/agendamento NAO sao declarados aqui de proposito:
 * qualquer etapa fora do MENU ja ganha begin_scheduling/begin_rescheduling/
 * begin_cancellation automaticamente via steps/index.ts (SWITCH_TOOLS/
 * SWITCH_HANDLERS).
 */
export const postAttendanceResponseStep: StepDefinition = {
  id: "POST_ATTENDANCE_RESPONSE",
  instructions: () =>
    "Etapa: o paciente esta respondendo a uma mensagem espontanea de acompanhamento pos-procedimento (parte de um fluxo " +
    "configurado pela clinica: pode ser um check-in simples, uma pergunta aberta sobre como ele esta se sentindo, um " +
    "pedido de avaliacao no Google, ou um lembrete de retorno). Converse como uma recepcionista atenciosa e natural, " +
    "usando o historico real do paciente - nunca de forma generica ou robotica. Voce NAO e profissional de saude: nunca " +
    'diagnostique, nunca diga "isso e normal" ou "nao e nada", nunca faca perguntas de triagem clinica.\n\n' +
    "ATENCAO MAXIMA: se a resposta mencionar, mesmo de forma indireta ou incerta, qualquer sinal de possivel " +
    "complicacao - dor fora do esperado, inchaco excessivo, sangramento, vermelhidao fora do normal, febre, sinais de " +
    "infeccao, ou palavras como \"complicacao\"/\"urgente\" - chame IMEDIATAMENTE a ferramenta flag_concern, sem fazer " +
    "mais perguntas antes. Sua resposta ao paciente nesse caso deve soar calma e acolhedora (nunca alarmante): " +
    "reconheca o que foi relatado sem minimizar nem tentar diagnosticar, diga que a equipe ja foi avisada e vai dar " +
    "atencao a isso agora, e se o relato parecer serio (sangramento intenso, febre alta, dificuldade para respirar) " +
    "oriente a procurar atendimento medico/pronto-socorro imediatamente, sem gerar panico. Nunca mencione sistema, " +
    "protocolo ou IA.\n\n" +
    "Se for so uma atualizacao positiva ou neutra, responda com calor humano, sem chamar nenhuma ferramenta. Se pedir " +
    "para agendar um retorno, chame begin_scheduling. Se pedir explicitamente para nao receber mais essas mensagens de " +
    "acompanhamento, chame stop_followup. Se a resposta demonstrar interesse comercial num novo procedimento sem pedir " +
    "pra agendar agora (ex: perguntar preco, dizer que vai pensar), chame flag_opportunity. Para qualquer outro motivo de " +
    "encaminhamento a um atendente humano, chame request_human_handoff.",
  tools: [
    FLAG_OPPORTUNITY_TOOL,
    {
      name: "flag_concern",
      description:
        "Chame IMEDIATAMENTE se a resposta mencionar, mesmo indiretamente, dor incomum, inchaco excessivo, sangramento, " +
        "vermelhidao fora do esperado, febre, sinais de infeccao, ou 'complicacao'/'urgente' relacionados ao procedimento recente.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string", description: "Resumo curto (para a equipe, no CRM) do que foi relatado" } },
        required: ["reason"],
      },
    },
    {
      name: "stop_followup",
      description: "Paciente pediu explicitamente para nao receber mais mensagens de acompanhamento pos-atendimento.",
      input_schema: { type: "object", properties: {} },
    },
    HUMAN_HANDOFF_TOOL,
    ABANDON_TOOL,
  ],
  handlers: {
    flag_opportunity: flagOpportunity,
    flag_concern: async (ctx, input) => {
      const { postAttendanceEnrollmentId } = ctx.conversation.state_data;
      const reason = String(input.reason || "").slice(0, 300);
      logger.warn(SCOPE, "Possivel complicacao sinalizada pelo paciente", { conversationId: ctx.conversation.id, postAttendanceEnrollmentId, reason });
      if (postAttendanceEnrollmentId) await postAttendanceEngine.flagConcern(postAttendanceEnrollmentId, reason);
      await conversationRepository.setPriority(ctx.conversation.id, true);

      const message =
        "Responda agora ao paciente de forma calma, gentil e acolhedora (nunca alarmante), reconhecendo o que ele " +
        "relatou, sem minimizar nem tentar diagnosticar. Diga que a equipe ja foi avisada e vai dar atencao a isso " +
        "agora mesmo. Se o relato parecer serio (sangramento intenso, febre alta, dificuldade para respirar), oriente " +
        "a procurar atendimento medico/pronto-socorro imediatamente, sem gerar panico. Nao use termos tecnicos nem " +
        "mencione sistema, protocolo ou IA. No maximo 3-4 frases.";
      return { nextStep: "MENU", data: {}, message, handoffRequested: true };
    },
    stop_followup: async (ctx) => {
      const { postAttendanceEnrollmentId } = ctx.conversation.state_data;
      logger.info(SCOPE, "Paciente pediu para parar acompanhamento de pos-atendimento", { conversationId: ctx.conversation.id, postAttendanceEnrollmentId });
      if (postAttendanceEnrollmentId) await postAttendanceEngine.stopFollowup(postAttendanceEnrollmentId);
      const message = await aiKnowledgeService.getMessageTemplate("post_attendance_stop_ack");
      return { nextStep: "MENU", data: {}, message };
    },
    request_human_handoff: requestHumanHandoff,
    abandon_flow: abandonFlow,
  },
};
