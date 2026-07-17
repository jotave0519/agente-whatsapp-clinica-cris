import { ConversationFlowState } from "../../types";
import { StepDefinition } from "../types";
import { cancellationSteps } from "./cancellation";
import { clinicCancellationSteps } from "./clinicCancellation";
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
 * Identifica a unica ferramenta de acao "primaria" de uma etapa (ignorando
 * abandon_flow e as ferramentas de troca de fluxo begin_*, que agora toda
 * etapa nao-MENU tambem expoe), usada pelo fast-path deterministico de
 * confirmacao no engine.
 */
export function getPrimaryToolName(step: StepDefinition): string | null {
  const candidates = step.tools.filter((tool) => tool.name !== "abandon_flow" && !tool.name.startsWith("begin_"));
  return candidates.length === 1 ? candidates[0].name : null;
}
