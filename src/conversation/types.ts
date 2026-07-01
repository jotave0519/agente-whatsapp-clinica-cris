import { Conversation, ConversationFlowState, FlowStateData, User } from "../types";

/** Contexto disponivel para qualquer handler de ferramenta de uma etapa. */
export interface FlowContext {
  user: User;
  conversation: Conversation;
  isFirstMessage: boolean;
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Resultado de um handler: para onde ir, com que dados, e o que reportar. */
export interface StepResult {
  nextStep: ConversationFlowState;
  data: FlowStateData;
  /** Conteudo do tool_result devolvido ao modelo (etapas normais) OU a mensagem final (fast-path/erro). */
  message: string;
  /** So usado por request_human_handoff: sinaliza que a conversa deve passar para atendimento humano. */
  handoffRequested?: boolean;
}

export type ToolHandler = (ctx: FlowContext, input: any) => Promise<StepResult>;

/**
 * Definicao completa de uma etapa da conversa: instrucoes, ferramentas
 * disponiveis e o que cada ferramenta faz. Tudo num unico lugar, para que
 * nunca fique inconsistente entre "o que o prompt diz" e "o que o codigo aceita".
 */
export interface StepDefinition {
  id: ConversationFlowState;
  /** Texto de instrucao especifico desta etapa (a regra global fica em prompt.ts). */
  instructions: (ctx: FlowContext) => string;
  tools: ToolSchema[];
  handlers: Record<string, ToolHandler>;
}
