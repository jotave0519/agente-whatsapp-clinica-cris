import { ToolHandler, ToolSchema } from "../types";
import { beginCancellation } from "./cancellation";
import { beginRescheduling } from "./rescheduling";
import { beginScheduling } from "./scheduling";

/**
 * Ferramentas de troca deliberada de fluxo, disponiveis tanto no MENU quanto
 * (via steps/index.ts) em qualquer etapa intermediaria de agendamento,
 * remarcacao ou cancelamento - para o cliente poder mudar de assunto no meio
 * de um atendimento (ex: "quero marcar outra consulta" durante uma remarcacao)
 * sem precisar desistir e recomecar do zero.
 */
export const SWITCH_TOOLS: ToolSchema[] = [
  {
    name: "begin_scheduling",
    description:
      "Inicia o fluxo de agendamento. Chame IMEDIATAMENTE ao perceber que o cliente quer agendar algo, mesmo sem " +
      "saber ainda o procedimento, nome ou data - esses dados serao perguntados nas proximas etapas se nao informados aqui. " +
      "Tambem use para TROCAR para este fluxo caso o cliente peça isso no meio de outro atendimento (o progresso anterior sera descartado).",
    input_schema: {
      type: "object",
      properties: {
        procedure: { type: "string", description: "Procedimento de interesse, se ja mencionado nesta mensagem (ex: Botox, avaliacao)" },
        name: { type: "string", description: "Nome completo do paciente, se ja informado nesta mensagem" },
        date: { type: "string", description: "Data desejada (YYYY-MM-DD), se ja informada nesta mensagem" },
      },
    },
  },
  {
    name: "begin_rescheduling",
    description:
      "Inicia o fluxo de remarcacao de um agendamento existente do cliente atual. Tambem use para TROCAR para este fluxo " +
      "caso o cliente peça isso no meio de outro atendimento (o progresso anterior sera descartado).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "begin_cancellation",
    description:
      "Inicia o fluxo de cancelamento de um agendamento existente do cliente atual. Tambem use para TROCAR para este fluxo " +
      "caso o cliente peça isso no meio de outro atendimento (o progresso anterior sera descartado).",
    input_schema: { type: "object", properties: {} },
  },
];

export const SWITCH_HANDLERS: Record<string, ToolHandler> = {
  begin_scheduling: beginScheduling,
  begin_rescheduling: beginRescheduling,
  begin_cancellation: beginCancellation,
};
