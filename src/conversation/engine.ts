import { CONTEXT_EXPIRY_MINUTES } from "../config/conversationPolicy";
import { env } from "../config/env";
import { createMessage } from "../integrations/anthropicClient";
import * as conversationRepository from "../repositories/conversationRepository";
import { Conversation, User } from "../types";
import { logger } from "../utils/logger";
import { isAbandon, isConfirmation } from "./confirmations";
import { currentDateTimeLabel, GLOBAL_RULES } from "./prompt";
import { getPrimaryToolName, getStep } from "./steps";
import { FlowContext, StepDefinition } from "./types";

const SCOPE = "conversation.engine";

export interface EngineResult {
  reply: string;
  handoffRequested: boolean;
}

/**
 * Uma conversa e considerada expirada (contexto de atendimento encerrado) se
 * foi fechada explicitamente (manualmente ou pelo cron de inatividade) ou se
 * o cliente ficou tempo demais sem responder - mesmo que por algum motivo o
 * cron de inatividade nao tenha rodado a tempo (ex: deploy, instabilidade).
 * O historico de mensagens NUNCA e apagado por isso, so a etapa do fluxo
 * (state/state_data) e reiniciada para MENU, para nao presumir que o cliente
 * ainda quer concluir um agendamento abandonado ha dias.
 */
function isConversationStale(conversation: Conversation): boolean {
  if (conversation.status === "closed") return true;
  if (!conversation.last_user_message_at) return false;
  const elapsedMs = Date.now() - new Date(conversation.last_user_message_at).getTime();
  return elapsedMs > CONTEXT_EXPIRY_MINUTES * 60 * 1000;
}

/**
 * Ponto de entrada: processa uma mensagem do cliente dentro da etapa atual da
 * conversa, chamando a Claude apenas com o prompt e as ferramentas daquela
 * etapa especifica (nunca o conjunto completo), e persiste a transicao de
 * estado a cada ferramenta executada.
 */
export async function runTurn(user: User, conversation: Conversation, userMessage: string): Promise<EngineResult> {
  logger.info(SCOPE, "runTurn: inicio", {
    userId: user.id,
    conversationId: conversation.id,
    status: conversation.status,
    state: conversation.state,
    lastUserMessageAt: conversation.last_user_message_at,
    userMessage,
  });

  const stale = isConversationStale(conversation);
  if (stale && conversation.state !== "MENU") {
    logger.info(SCOPE, "Contexto de atendimento expirado - reiniciando fluxo para MENU (historico preservado)", {
      conversationId: conversation.id,
      previousState: conversation.state,
      previousStateData: conversation.state_data,
    });
    await conversationRepository.updateConversationFlow(conversation.id, "MENU", {});
    conversation = { ...conversation, state: "MENU", state_data: {} };
  }

  const priorMessages = await conversationRepository.listMessages(conversation.id);
  const isFirstMessage = priorMessages.length === 0 || stale;
  await conversationRepository.addMessage(conversation.id, "user", userMessage);

  const currentStep = getStep(conversation.state);

  // Fast-path deterministico: em uma etapa de confirmacao, uma resposta
  // afirmativa clara executa a acao direto, sem depender do modelo chamar a
  // ferramenta corretamente.
  const primaryTool = getPrimaryToolName(currentStep);
  if (primaryTool?.startsWith("confirm_") && isConfirmation(userMessage)) {
    logger.info(SCOPE, "Fast-path de confirmacao acionado", { conversationId: conversation.id, state: conversation.state, tool: primaryTool });
    const ctx: FlowContext = { user, conversation, isFirstMessage };
    const result = await currentStep.handlers[primaryTool](ctx, {});
    return finalize(conversation, result);
  }

  if (conversation.state !== "MENU" && isAbandon(userMessage)) {
    logger.info(SCOPE, "Fast-path de abandono acionado", { conversationId: conversation.id, state: conversation.state });
    const ctx: FlowContext = { user, conversation, isFirstMessage };
    const result = await currentStep.handlers.abandon_flow(ctx, {});
    return finalize(conversation, result);
  }

  // Se o contexto expirou, o historico anterior fica preservado no banco (a CRM
  // continua mostrando a conversa completa), mas NAO entra no contexto ativo do
  // modelo: caso contrario a Claude pode "ler" a intencao antiga (ex: "quero
  // agendar um botox") no historico e retomar o fluxo sozinha, mesmo com o
  // estado ja reiniciado para MENU - foi exatamente esse o bug observado.
  const history: any[] = stale ? [] : priorMessages.map((m) => ({ role: m.role, content: m.content }));
  history.push({ role: "user", content: userMessage });

  let workingConversation = conversation;
  let handoffRequested = false;

  try {
    let iteration = 0;
    while (true) {
      iteration += 1;
      const step = getStep(workingConversation.state);
      const ctx: FlowContext = { user, conversation: workingConversation, isFirstMessage };
      const systemPrompt = await buildSystemPrompt(step, ctx);

      logger.info(SCOPE, `Chamando Claude (iteracao ${iteration})`, {
        conversationId: conversation.id,
        state: workingConversation.state,
        tools: step.tools.map((t) => t.name),
        historyLength: history.length,
      });

      const response = await createMessage({
        model: env.anthropicModel,
        max_tokens: 1024,
        system: systemPrompt,
        tools: step.tools,
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
          if (block.type !== "tool_use") continue;

          const handler = step.handlers[block.name!];
          let output: string;

          if (!handler) {
            logger.error(SCOPE, `Ferramenta '${block.name}' nao disponivel na etapa ${step.id}`);
            output = JSON.stringify({ error: `Ferramenta '${block.name}' nao disponivel nesta etapa.` });
          } else {
            logger.info(SCOPE, "Executando ferramenta", { name: block.name, input: block.input, state: workingConversation.state });
            try {
              const result = await handler({ user, conversation: workingConversation, isFirstMessage }, block.input);
              logger.info(SCOPE, "Resultado da ferramenta", { name: block.name, novoEstado: result.nextStep, mensagem: result.message });

              await conversationRepository.updateConversationFlow(workingConversation.id, result.nextStep, result.data);
              workingConversation = { ...workingConversation, state: result.nextStep, state_data: result.data };
              if (result.handoffRequested) handoffRequested = true;
              output = result.message;
            } catch (err) {
              logger.error(SCOPE, `Excecao ao executar ferramenta ${block.name}`, err);
              output = `Erro ao executar ${block.name}: ${(err as Error).message}`;
            }
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output });
        }

        history.push({ role: "user", content: toolResults });
        continue;
      }

      const finalText = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      logger.info(SCOPE, "runTurn: resposta final", { conversationId: conversation.id, finalText, handoffRequested });
      await conversationRepository.addMessage(conversation.id, "assistant", finalText);
      if (handoffRequested) {
        await conversationRepository.updateConversationStatus(conversation.id, "human");
      }
      return { reply: finalText, handoffRequested };
    }
  } catch (err) {
    logger.error(SCOPE, "runTurn: excecao no loop de conversa com a Claude", err);
    throw err;
  }
}

async function buildSystemPrompt(step: StepDefinition, ctx: FlowContext): Promise<string> {
  const header = GLOBAL_RULES + `Data e hora atual: ${currentDateTimeLabel()} (America/Sao_Paulo).\n\n`;
  const guardrail =
    step.id === "MENU"
      ? ""
      : "Voce esta no meio de um atendimento de agendamento/remarcacao/cancelamento EM ANDAMENTO. " +
        "E PROIBIDO voltar ao menu principal, listar as opcoes novamente, ou mudar de assunto antes de concluir esta operacao. " +
        "Se o cliente pedir claramente para parar ou desistir deste fluxo, chame abandon_flow. Fora isso, siga apenas a etapa atual abaixo:\n\n";

  return header + guardrail + (await step.instructions(ctx));
}

async function finalize(conversation: Conversation, result: { nextStep: Conversation["state"]; data: Conversation["state_data"]; message: string; handoffRequested?: boolean }): Promise<EngineResult> {
  await conversationRepository.updateConversationFlow(conversation.id, result.nextStep, result.data);
  await conversationRepository.addMessage(conversation.id, "assistant", result.message);
  if (result.handoffRequested) {
    await conversationRepository.updateConversationStatus(conversation.id, "human");
  }
  return { reply: result.message, handoffRequested: !!result.handoffRequested };
}
