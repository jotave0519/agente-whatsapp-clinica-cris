import { ConversationFlowState } from "../../types";
import { StepDefinition } from "../types";
import { cancellationSteps } from "./cancellation";
import { clinicCancellationSteps } from "./clinicCancellation";
import { commercialFollowupResponseStep } from "./commercialFollowupResponse";
import { menuStep } from "./menu";
import { postAttendanceResponseStep } from "./postAttendanceResponse";
import { reactivationResponseStep } from "./reactivationResponse";
import { reminderResponseStep } from "./reminderResponse";
import { reschedulingSteps } from "./rescheduling";
import { schedulingSteps } from "./scheduling";
import { SWITCH_HANDLERS, SWITCH_TOOLS } from "./switchFlow";

const ALL_STEPS: StepDefinition[] = [
  menuStep,
  ...schedulingSteps,
  ...reschedulingSteps,
  ...cancellationSteps,
  ...clinicCancellationSteps,
  reminderResponseStep,
  reactivationResponseStep,
  postAttendanceResponseStep,
  commercialFollowupResponseStep,
];

// Fora do MENU, toda etapa tambem ganha as ferramentas de troca de fluxo
// (begin_scheduling/begin_rescheduling/begin_cancellation): sem isso o
// cliente nao tem como pedir algo diferente no meio de um atendimento em
// andamento. O MENU ja inclui essas ferramentas nativamente (steps/menu.ts),
// entao fica de fora da mesclagem para nao duplicar.
const STEP_MAP = new Map<ConversationFlowState, StepDefinition>(
  ALL_STEPS.map((step) => [
    step.id,
    step.id === "MENU"
      ? step
      : { ...step, tools: [...step.tools, ...SWITCH_TOOLS], handlers: { ...step.handlers, ...SWITCH_HANDLERS } },
  ])
);

const REQUIRED_STATES: ConversationFlowState[] = [
  "MENU",
  "SCHEDULING_PROCEDURE",
  "SCHEDULING_NAME",
  "SCHEDULING_DATE",
  "SCHEDULING_TIME",
  "SCHEDULING_CONFIRM",
  "RESCHEDULING_SELECT",
  "RESCHEDULING_DATE",
  "RESCHEDULING_TIME",
  "RESCHEDULING_CONFIRM",
  "CANCELING_SELECT",
  "CANCELING_CONFIRM",
  "CLINIC_CANCELLED_OFFER",
  "REMINDER_RESPONSE",
  "REACTIVATION_RESPONSE",
  "POST_ATTENDANCE_RESPONSE",
  "COMMERCIAL_FOLLOWUP_RESPONSE",
];

// Falha rapido e alto na inicializacao do processo, em vez de se comportar de
// forma inconsistente em producao se algum estado ficar sem definicao.
for (const state of REQUIRED_STATES) {
  if (!STEP_MAP.has(state)) {
    throw new Error(`Etapa de conversa nao definida em src/conversation/steps: ${state}`);
  }
}

export function getStep(state: ConversationFlowState): StepDefinition {
  const step = STEP_MAP.get(state);
  if (!step) {
    throw new Error(`Estado de conversa desconhecido: ${state}`);
  }
  return step;
}

/**
 * Identifica a ferramenta de confirmacao (prefixo confirm_) de uma etapa,
 * usada pelo fast-path deterministico de confirmacao no engine (uma resposta
 * afirmativa clara do cliente executa a acao direto, sem chamar o modelo).
 * Filtra especificamente por esse prefixo (nao so "unica ferramenta que nao e
 * abandon_flow/begin_*") para que etapas de confirmacao possam ganhar outras
 * ferramentas auxiliares (ex: provide_date/change_time em SCHEDULING_CONFIRM,
 * para o cliente poder trocar de data/horario sem reiniciar o fluxo) sem
 * desativar esse fast-path.
 */
export function getPrimaryToolName(step: StepDefinition): string | null {
  const confirmTools = step.tools.filter((tool) => tool.name.startsWith("confirm_"));
  return confirmTools.length === 1 ? confirmTools[0].name : null;
}
