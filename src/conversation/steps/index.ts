import { ConversationFlowState } from "../../types";
import { StepDefinition } from "../types";
import { cancellationSteps } from "./cancellation";
import { menuStep } from "./menu";
import { reschedulingSteps } from "./rescheduling";
import { schedulingSteps } from "./scheduling";

const ALL_STEPS: StepDefinition[] = [menuStep, ...schedulingSteps, ...reschedulingSteps, ...cancellationSteps];

const STEP_MAP = new Map<ConversationFlowState, StepDefinition>(ALL_STEPS.map((step) => [step.id, step]));

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
 * Identifica a unica ferramenta de acao de uma etapa (ignorando abandon_flow),
 * usada pelo fast-path deterministico de confirmacao no engine.
 */
export function getPrimaryToolName(step: StepDefinition): string | null {
  const candidates = step.tools.filter((tool) => tool.name !== "abandon_flow");
  return candidates.length === 1 ? candidates[0].name : null;
}
