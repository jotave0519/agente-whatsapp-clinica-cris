import { Request, Response } from "express";
import { parseIncomingWebhook, sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import { getOrCreateUserByPhone } from "../services/userService";
import * as conversationRepository from "../repositories/conversationRepository";
import * as conversationEngine from "../conversation/engine";
import * as aiKnowledgeService from "../services/aiKnowledgeService";
import * as postAttendanceEngine from "../services/postAttendanceEngine";
import * as reactivationEngine from "../services/reactivationEngine";
import { logger } from "../utils/logger";

const SCOPE = "webhookController";

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  logger.info(SCOPE, "Webhook recebido", { body: req.body });

  const incoming = parseIncomingWebhook(req.body);

  if (!incoming) {
    logger.info(SCOPE, "Evento ignorado (nao e mensagem de texto recebida)");
    res.status(200).json({ status: "ignored" });
    return;
  }

  const { phone, text, pushName } = incoming;
  logger.info(SCOPE, "Mensagem recebida", { phone, text, pushName });

  try {
    // Nunca usar o pushName do WhatsApp como nome do paciente (pode vir vazio,
    // com apelido, emoji ou nome de empresa) - o nome real e sempre capturado
    // explicitamente no fluxo de agendamento (SCHEDULING_NAME) e persistido em
    // users.name. Cliente novo nasce com name: "".
    const user = await getOrCreateUserByPhone(phone);
    logger.info(SCOPE, "Usuario resolvido", { userId: user.id, phone: user.phone, name: user.name, pushName });

    const conversation = await conversationRepository.findOrCreateActiveConversation(user.id);
    logger.info(SCOPE, "Conversa resolvida", {
      conversationId: conversation.id,
      status: conversation.status,
      state: conversation.state,
      stateData: conversation.state_data,
    });

    const wasClosed = conversation.status === "closed";
    await conversationRepository.touchUserActivity(conversation.id, wasClosed);
    if (wasClosed) {
      logger.info(SCOPE, "Conversa estava encerrada - sera reaberta e o fluxo de atendimento reiniciado", { conversationId: conversation.id });
    }

    // Marca "paciente respondeu" a uma campanha de reativacao no instante exato
    // em que a mensagem chega, independente do que a IA decidir fazer com o
    // conteudo dela (mesmo se a conversa expirar por inatividade e o fluxo for
    // reiniciado logo em seguida dentro do runTurn). Isolado em try/catch - uma
    // falha aqui nunca pode impedir o atendimento normal de continuar.
    if (conversation.state === "REACTIVATION_RESPONSE" && conversation.state_data.reactivationTargetId) {
      try {
        await reactivationEngine.markResponded(conversation.state_data.reactivationTargetId);
      } catch (err) {
        logger.error(SCOPE, "Falha ao marcar resposta de campanha de reativacao", err);
      }
    }

    // Bloco isolado do de cima (reativacao) de proposito - uma falha aqui
    // nunca pode impedir a marcacao de reativacao, e vice-versa.
    if (conversation.state === "POST_ATTENDANCE_RESPONSE" && conversation.state_data.postAttendanceEnrollmentId) {
      try {
        await postAttendanceEngine.markResponded(conversation.state_data.postAttendanceEnrollmentId);
      } catch (err) {
        logger.error(SCOPE, "Falha ao marcar resposta de pos-atendimento", err);
      }
    }

    // Nao sobrescrevemos conversation.status em memoria mesmo apos reabrir no banco:
    // o engine usa o status original ("closed") para saber que o contexto expirou e
    // reiniciar o fluxo. Isso e seguro aqui porque "closed" nunca e igual a "human".
    if (conversation.status === "human") {
      logger.info(SCOPE, "Conversa em atendimento humano - mensagem apenas registrada", { conversationId: conversation.id });
      await conversationRepository.addMessage(conversation.id, "user", text);
      res.status(200).json({ status: "ok", handled_by: "human" });
      return;
    }

    const wasPostAttendanceResponse = conversation.state === "POST_ATTENDANCE_RESPONSE";

    logger.info(SCOPE, "Encaminhando para conversationEngine.runTurn", { conversationId: conversation.id, state: conversation.state });
    const { reply, handoffRequested } = await conversationEngine.runTurn(user, conversation, text);
    logger.info(SCOPE, "Resposta gerada pelo agente", { conversationId: conversation.id, handoffRequested, reply });

    // Rede de seguranca deterministica: se a Claude nao escalou nada nesse
    // turno mas o texto bate com palavras-chave de possivel complicacao,
    // sinaliza mesmo assim. Roda so DEPOIS do runTurn (nunca antes - forcar
    // status humano cedo demais deixaria o paciente sem resposta nesse turno,
    // o oposto do que se quer) e nunca altera a resposta ja decidida.
    if (wasPostAttendanceResponse && !handoffRequested && postAttendanceEngine.looksLikeClinicalConcern(text)) {
      try {
        await conversationRepository.setPriority(conversation.id, true);
        await conversationRepository.updateConversationStatus(conversation.id, "human");
        if (conversation.state_data.postAttendanceEnrollmentId) {
          await postAttendanceEngine.recordFailsafeAlert(conversation.state_data.postAttendanceEnrollmentId);
        }
        logger.warn(SCOPE, "Fail-safe deterministico de pos-atendimento acionado", { conversationId: conversation.id, text });
      } catch (err) {
        logger.error(SCOPE, "Falha ao acionar fail-safe de pos-atendimento", err);
      }
    }

    await sendWhatsAppMessage(phone, reply);
    logger.info(SCOPE, "Resposta enviada via Evolution API", { phone });

    res.status(200).json({ status: "ok" });
  } catch (err) {
    logger.error(SCOPE, `Erro ao processar mensagem de ${phone}`, err);
    try {
      const errorText = await aiKnowledgeService.getMessageTemplate("generic_error");
      await sendWhatsAppMessage(phone, errorText);
    } catch (sendErr) {
      logger.error(SCOPE, `Falha tambem ao enviar mensagem de erro para ${phone}`, sendErr);
    }
    res.status(200).json({ status: "error" });
  }
}
