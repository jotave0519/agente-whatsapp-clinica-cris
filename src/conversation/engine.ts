import { env } from "../config/env";
import { createMessage } from "../integrations/anthropicClient";
import * as conversationRepository from "../repositories/conversationRepository";
import * as aiKnowledgeService from "../services/aiKnowledgeService";
import * as commercialEngine from "../services/commercialEngine";
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
async function isConversationStale(conversation: Conversation): Promise<boolean> {
  if (conversation.status === "closed") return true;
  if (!conversation.last_user_message_at) return false;
  const contextExpiryMinutes = await aiKnowledgeService.getContextExpiryMinutes();
  const elapsedMs = Date.now() - new Date(conversation.last_user_message_at).getTime();
  return elapsedMs > contextExpiryMinutes * 60 * 1000;
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

  const stale = await isConversationStale(conversation);
  if (stale && conversation.state !== "MENU") {
    logger.info(SCOPE, "Contexto de atendimento expirado - reiniciando fluxo para MENU (historico preservado)", {
      conversationId: conversation.id,
      previousState: conversation.state,
      previousStateData: conversation.state_data,
    });

    // Mesmo sinal capturado em abandonFlow (shared.ts), pro caso do cliente
    // simplesmente sumir no meio de um agendamento em vez de abandonar
    // explicitamente - so o estado SCHEDULING_* com procedimento ja conhecido
    // conta (nunca remarcacao/cancelamento/etapas de resposta espontanea).
    // Isolado em try/catch: uma falha aqui nunca pode impedir o reset normal.
    if (conversation.state.startsWith("SCHEDULING_") && conversation.state_data.procedure) {
      try {
        await commercialEngine.flagAbandonedScheduling(user.id, conversation.state_data.procedure);
      } catch (err) {
        logger.error(SCOPE, "Falha ao sinalizar oportunidade comercial (expiracao durante agendamento)", err);
      }
    }

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
  function buildHistory(): any[] {
    const h: any[] = stale ? [] : priorMessages.map((m) => ({ role: m.role, content: m.content }));
    h.push({ role: "user", content: userMessage });
    return h;
  }

  /**
   * Loop de chamadas a Claude para uma unica tentativa de atendimento, a
   * partir de `startingConversation`. Extraido para poder ser chamado uma
   * segunda vez (com o estado resetado) se a primeira tentativa falhar - ver
   * runTurn(). Cada chamada monta seu proprio historico do zero (nunca reusa
   * entradas parciais de uma tentativa anterior que tenha falhado no meio).
   */
  async function runLoop(startingConversation: Conversation): Promise<EngineResult> {
    const history = buildHistory();
    let workingConversation = startingConversation;
    let handoffRequested = false;
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

        const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
        const toolResults = [];
        // So tem efeito se essa foi a UNICA ferramenta chamada nessa rodada -
        // com mais de uma chamada em paralelo, sempre segue o fluxo normal
        // (uma segunda chamada ao modelo) para nao arriscar ignorar a outra.
        let finalReplyText: string | null = null;

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
              if (result.finalReply && toolUseBlocks.length === 1) finalReplyText = output;
            } catch (err) {
              logger.error(SCOPE, `Excecao ao executar ferramenta ${block.name}`, err);
              // Nunca repassar err.message (texto tecnico) para o tool_result - o
              // modelo poderia parafrasear/vazar isso pro cliente. Em vez disso, uma
              // instrucao segura, seguindo a REGRA CRITICA de nao mencionar detalhes
              // tecnicos em GLOBAL_RULES.
              const fallback = await aiKnowledgeService.getMessageTemplate("generic_error");
              output =
                `Ocorreu um problema tecnico interno ao tentar concluir essa acao. NAO mencione detalhes tecnicos, codigos ou nomes de ` +
                "sistemas ao cliente. Peca desculpas de forma natural e sugira tentar novamente em instantes (repetir a informacao ou " +
                `tentar de novo daqui a pouco). Exemplo de tom: "${fallback}"`;
            }
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output });
        }

        // Resposta final montada deterministicamente em codigo (ex: resumo de
        // confirmacao de agendamento com a data/horario exatos do state_data) -
        // pula a chamada extra ao modelo que normalmente redigiria essa mensagem,
        // eliminando o risco dele puxar uma data antiga solta no historico da conversa.
        if (finalReplyText !== null) {
          logger.info(SCOPE, "runTurn: resposta final deterministica (sem nova chamada ao modelo)", {
            conversationId: conversation.id,
            finalText: finalReplyText,
            handoffRequested,
          });
          await conversationRepository.addMessage(conversation.id, "assistant", finalReplyText);
          if (handoffRequested) {
            await conversationRepository.updateConversationStatus(conversation.id, "human");
          }
          return { reply: finalReplyText, handoffRequested };
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
  }

  try {
    return await runLoop(conversation);
  } catch (err) {
    // Recuperacao automatica: em vez de desistir na primeira falha, trata
    // como possivel estado inconsistente/preso, reseta para MENU e tenta mais
    // uma vez do zero antes de reportar erro ao cliente. A mensagem do
    // usuario ja foi persistida acima (fora deste bloco), entao a nova
    // tentativa nao a duplica. Nao ajuda em falhas que independem do estado
    // (ex: API fora do ar), mas essas tambem nao sao prejudicadas por isso -
    // so custam uma tentativa extra antes do fallback de erro de sempre.
    logger.error(SCOPE, "runTurn: excecao no loop de conversa - tentando recuperar reiniciando para MENU", err);
    try {
      await conversationRepository.updateConversationFlow(conversation.id, "MENU", {});
      const recoveredConversation: Conversation = { ...conversation, state: "MENU", state_data: {} };
      return await runLoop(recoveredConversation);
    } catch (err2) {
      logger.error(SCOPE, "runTurn: falha tambem na tentativa de recuperacao", err2);
      throw err2;
    }
  }
}

async function buildSystemPrompt(step: StepDefinition, ctx: FlowContext): Promise<string> {
  const header = GLOBAL_RULES + `Data e hora atual: ${currentDateTimeLabel()} (America/Sao_Paulo).\n\n`;
  const guardrail =
    step.id === "MENU"
      ? ""
      : "Voce esta no meio de um atendimento de agendamento/remarcacao/cancelamento EM ANDAMENTO. " +
        "E PROIBIDO voltar ao menu principal, listar as opcoes novamente, ou desviar para conversa fora do assunto antes de concluir esta operacao. " +
        "EXCECAO: se o cliente pedir claramente uma acao diferente de agendamento/remarcacao/cancelamento (ex: pede para marcar outra consulta " +
        "no meio de uma remarcacao, ou quer cancelar no meio de um agendamento), chame AGORA a ferramenta begin_scheduling, begin_rescheduling ou " +
        "begin_cancellation correspondente para trocar de fluxo - o progresso desta etapa atual sera descartado. " +
        "Se o cliente so quiser parar, sem pedir outra coisa no lugar, chame abandon_flow. Fora essas duas situacoes, siga apenas a etapa atual abaixo:\n\n";

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
