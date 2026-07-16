import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as conversationRepository from "../repositories/conversationRepository";
import * as reactivationEventRepository from "../repositories/reactivationEventRepository";
import * as reactivationMessageRepository from "../repositories/reactivationMessageRepository";
import * as reactivationRepository from "../repositories/reactivationRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import { SegmentationRow } from "../repositories/scheduleRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import * as userRepository from "../repositories/userRepository";
import { ReactivationCampaign, ReactivationTarget, ScheduleStatus } from "../types";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import * as aiKnowledgeService from "./aiKnowledgeService";
import { composeReactivationMessage } from "./reactivationMessageService";

const SCOPE = "reactivationEngine";

/**
 * IA de reativacao de pacientes - identifica pacientes inativos, roda
 * campanhas segmentadas com mensagem inicial composta pela Claude (personalizada
 * com o historico real do paciente, nao um template fixo) + no maximo N
 * lembretes de nao-resposta configuraveis por campanha. Mesmo padrao
 * arquitetural do motor de confirmacao de consultas (src/services/reminderEngine.ts):
 * tabela dedicada + claim atomico + revalidacao no momento do envio.
 *
 * Dois estagios: `scanEligiblePatients()` roda 1x/dia (varre e classifica),
 * `processDueMessages()` roda a cada minuto (envia respeitando dias/horario
 * permitidos de cada campanha e revalidando seguranca na hora do disparo).
 */

interface PatientSummary {
  userId: string;
  lastDate: string;
  lastProcedure: string;
  lastStatus: ScheduleStatus;
  concludedCount: number;
  procedures: Set<string>;
}

function summarize(rows: SegmentationRow[]): Map<string, PatientSummary> {
  const map = new Map<string, PatientSummary>();
  // rows vem ordenado por date ascendente (scheduleRepository.findAllForSegmentation) -
  // a ultima ocorrencia de cada user_id na iteracao e sempre a mais recente.
  for (const row of rows) {
    let s = map.get(row.user_id);
    if (!s) {
      s = { userId: row.user_id, lastDate: row.date, lastProcedure: row.procedure, lastStatus: row.status, concludedCount: 0, procedures: new Set() };
      map.set(row.user_id, s);
    }
    s.lastDate = row.date;
    s.lastProcedure = row.procedure;
    s.lastStatus = row.status;
    s.procedures.add(row.procedure);
    if (row.status === "Concluido") s.concludedCount += 1;
  }
  return map;
}

function matchesSegment(summary: PatientSummary, segmentType: string): boolean {
  if (segmentType === "all") return true;
  if (segmentType.startsWith("procedure:")) {
    const proc = segmentType.slice("procedure:".length).toLowerCase();
    return summary.lastProcedure.toLowerCase().includes(proc);
  }
  if (segmentType === "evaluation_only") {
    return summary.procedures.size === 1 && [...summary.procedures].every((p) => p.toLowerCase().includes("avalia"));
  }
  if (segmentType === "cancelled") return summary.lastStatus === "Cancelado";
  if (segmentType === "no_show") return summary.lastStatus === "Faltou";
  if (segmentType === "never_returned") return summary.concludedCount === 1;
  if (segmentType === "recurring") return summary.concludedCount >= 2;
  return false;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(`${dateStr}T12:00:00-03:00`).getTime()) / (24 * 3600 * 1000));
}

/**
 * Chamada tanto no scan diario quanto de novo no envio (processDueMessages).
 * A checagem de consulta futura aqui e, na pratica, so alcancada pelo
 * caminho de ENVIO: no scan, um paciente com consulta futura ja tem a data
 * dessa consulta como "ultimo agendamento" (summarize() usa a data mais
 * recente, passada ou futura), entao days_inactive fica negativo/baixo e ele
 * nunca bate o inactive_days da campanha antes mesmo de chegar aqui. Nao
 * remover essa checagem achando que e redundante - ela e o que protege o
 * caso real de um paciente marcar uma consulta DEPOIS que o target ja foi
 * criado, mas ANTES da mensagem ser enviada (confirmado em teste ao vivo).
 */
async function isSafeToEnroll(userId: string): Promise<boolean> {
  const user = await userRepository.findById(userId);
  if (!user || !user.active || user.do_not_contact) return false;

  const futureAppointments = await scheduleRepository.findActiveSchedulesByUser(userId);
  const today = new Date().toISOString().slice(0, 10);
  if (futureAppointments.some((s) => s.date >= today)) return false;

  const conversation = await conversationRepository.findActiveConversation(userId);
  if (conversation && conversation.status !== "closed") return false;

  return true;
}

/** Roda 1x/dia (ver reactivationCron.ts). Classifica pacientes elegiveis por campanha ativa e cria os targets novos. */
export async function scanEligiblePatients(): Promise<{ created: number }> {
  const settings = await settingsRepository.getClinicSettings();
  if (!settings.reactivation_enabled) return { created: 0 };

  const campaigns = await reactivationRepository.listActiveCampaigns();
  if (campaigns.length === 0) return { created: 0 };

  const rows = await scheduleRepository.findAllForSegmentation();
  const summaries = summarize(rows);
  const alreadyActive = await reactivationRepository.findUserIdsWithActiveTarget();
  const claimedThisRun = new Set<string>();

  let created = 0;

  for (const campaign of campaigns) {
    const candidates: { campaignId: string; userId: string; lastProcedure: string | null; daysInactive: number }[] = [];

    for (const summary of summaries.values()) {
      if (alreadyActive.has(summary.userId) || claimedThisRun.has(summary.userId)) continue;
      const inactiveDays = daysSince(summary.lastDate);
      if (inactiveDays < campaign.inactive_days) continue;
      if (!matchesSegment(summary, campaign.segment_type)) continue;
      candidates.push({ campaignId: campaign.id, userId: summary.userId, lastProcedure: summary.lastProcedure, daysInactive: inactiveDays });
    }

    if (candidates.length === 0) continue;

    const eligible = [];
    for (const candidate of candidates) {
      if (await isSafeToEnroll(candidate.userId)) {
        eligible.push(candidate);
        claimedThisRun.add(candidate.userId);
      }
    }
    if (eligible.length === 0) continue;

    const insertedTargets = await reactivationRepository.insertTargetsIfMissing(eligible);
    created += insertedTargets.length;

    for (const target of insertedTargets) {
      await reactivationEventRepository.record(target.id, "target_created");
      await reactivationMessageRepository.insertPending([{ targetId: target.id, tier: "initial", scheduledFor: new Date() }]);
    }

    logger.info(SCOPE, "Campanha processada no scan diario", { campaignId: campaign.id, name: campaign.name, created: insertedTargets.length });
  }

  return { created };
}

function isWithinAllowedWindow(campaign: ReactivationCampaign): boolean {
  const now = new Date();
  // Reconstroi a hora local de Sao Paulo a partir da string localizada, pra poder usar .getDay()
  // (0=domingo, mesma convencao ja usada em business_hours.weekday) sem depender de libs extras.
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const weekday = spNow.getDay();
  if (!campaign.allowed_weekdays.includes(weekday)) return false;

  const hhmm = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
  return hhmm >= campaign.allowed_hour_start.slice(0, 5) && hhmm <= campaign.allowed_hour_end.slice(0, 5);
}

async function buildPatientContext(userId: string, style: string) {
  const user = await userRepository.findById(userId);
  const rows = (await scheduleRepository.findAllForSegmentation()).filter((r) => r.user_id === userId);
  const concluded = rows.filter((r) => r.status === "Concluido");
  const last = rows[rows.length - 1];

  return {
    firstName: (user?.name || "").split(" ")[0] || "Olá",
    lastProcedure: last?.procedure ?? null,
    daysSinceLastVisit: last ? daysSince(last.date) : null,
    totalVisits: concluded.length,
    lastVisitStatus: (last?.status as "Concluido" | "Cancelado" | "Faltou" | undefined) ?? null,
    messageStyle: style,
  };
}

/** Roda a cada minuto (ver reactivationCron.ts). Processa mensagens vencidas e checa conversao de targets em espera. */
export async function processDueMessages(): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const due = await reactivationMessageRepository.findDue(50);

  for (const message of due) {
    const claimed = await reactivationMessageRepository.claim(message.id);
    if (!claimed) continue;

    try {
      const target = await reactivationRepository.findTargetById(message.target_id);
      if (!target || !["pending", "awaiting_response"].includes(target.status)) {
        await reactivationMessageRepository.markCancelled(message.id);
        skipped += 1;
        continue;
      }

      const campaign = await reactivationRepository.findCampaignById(target.campaign_id);
      if (!campaign || !campaign.active || !isWithinAllowedWindow(campaign)) {
        // Nao cancela - so pula esse tick, tenta de novo no proximo minuto dentro da janela permitida.
        await reactivationMessageRepository.markFailedOrRetry(message.id, -1, "Fora da janela permitida (dia/horario) ou campanha pausada");
        continue;
      }

      // Revalida seguranca no momento do envio (nao so confia na classificacao do scan diario).
      if (!(await isSafeToEnroll(target.user_id)) && target.status === "pending") {
        await reactivationMessageRepository.markCancelled(message.id);
        await reactivationRepository.setTargetStatus(target.id, "excluded");
        await reactivationEventRepository.record(target.id, "excluded", "Deixou de ser seguro no momento do envio");
        skipped += 1;
        continue;
      }

      const user = await userRepository.findById(target.user_id);
      if (!user || !user.phone) {
        await reactivationMessageRepository.markFailed(message.id, "Paciente sem telefone");
        failed += 1;
        continue;
      }

      let text: string | null;
      if (message.tier === "initial") {
        const ctx = await buildPatientContext(target.user_id, campaign.message_style);
        text = await composeReactivationMessage(ctx);
      } else {
        text = await aiKnowledgeService.getMessageTemplate("reactivation_nudge");
      }

      if (!text) {
        await reactivationMessageRepository.markFailedOrRetry(message.id, message.attempts, "Falha ao compor mensagem (Claude)");
        failed += 1;
        continue;
      }

      await withRetry(() => sendWhatsAppMessage(user.phone, text!), 1, 400);
      // Marcado ANTES de qualquer outra escrita - garante que uma falha no
      // bookkeeping abaixo nunca causa reenvio no proximo tick.
      await reactivationMessageRepository.markSent(message.id, text);
      sent += 1;

      try {
        if (message.tier === "initial") {
          await reactivationRepository.setTargetStatus(target.id, "awaiting_response");
          await reactivationEventRepository.record(target.id, "message_sent");
          if (campaign.max_messages > 1) {
            await reactivationMessageRepository.insertPending([
              { targetId: target.id, tier: "nudge_1", scheduledFor: new Date(Date.now() + campaign.nudge_interval_days * 24 * 3600_000) },
            ]);
          }
        } else {
          await reactivationEventRepository.record(target.id, "reminder_sent", message.tier);
          // Ultimo lembrete configurado enviado sem resposta - encerra a campanha para esse paciente.
          await reactivationRepository.setTargetStatus(target.id, "ignored");
          await reactivationEventRepository.record(target.id, "ignored");
        }

        const conversation = await conversationRepository.findOrCreateActiveConversation(target.user_id);
        await conversationRepository.addMessage(conversation.id, "assistant", text, true);
        await conversationRepository.touchUserActivity(conversation.id, true);
        await conversationRepository.updateConversationFlow(conversation.id, "REACTIVATION_RESPONSE", {
          reactivationTargetId: target.id,
        });
      } catch (bookkeepErr) {
        logger.error(SCOPE, "Mensagem de reativacao enviada, mas falha no bookkeeping", bookkeepErr);
      }
    } catch (err) {
      logger.error(SCOPE, "Falha ao processar mensagem de reativacao", err);
      await reactivationMessageRepository.markFailedOrRetry(message.id, message.attempts, err instanceof Error ? err.message : String(err));
      failed += 1;
    }
  }

  await checkConversions();

  return { sent, skipped, failed };
}

/**
 * Verifica, entre os targets ainda em aberto (pending/awaiting_response), se
 * o paciente ja tem um agendamento novo criado depois do enrollment - se sim,
 * marca como convertido e cancela qualquer lembrete pendente. Rodar isso como
 * uma checagem periodica (em vez de um hook dentro do fluxo de conversa)
 * evita tocar em codigo compartilhado do motor de agendamento
 * (schedulingService.createAppointment/beginScheduling continuam 100% inalterados).
 */
export async function checkConversions(): Promise<void> {
  const openTargets = await reactivationRepository.findNonTerminalTargets();
  if (openTargets.length === 0) return;

  for (const target of openTargets) {
    const schedules = await scheduleRepository.findAllByUserId(target.user_id);
    const newSchedule = schedules.find((s) => new Date(s.created_at) > new Date(target.created_at));
    if (!newSchedule) continue;

    await reactivationMessageRepository.cancelPendingForTarget(target.id);
    await reactivationRepository.setTargetStatus(target.id, "converted");
    await reactivationEventRepository.record(target.id, "converted", newSchedule.id);
  }
}

/** Chamado pelo step REACTIVATION_RESPONSE quando o paciente recusa explicitamente. */
export async function declineTarget(targetId: string): Promise<void> {
  await reactivationMessageRepository.cancelPendingForTarget(targetId);
  await reactivationRepository.setTargetStatus(targetId, "declined");
  await reactivationEventRepository.record(targetId, "declined");
}

/** Chamado pelo webhookController assim que uma mensagem chega numa conversa em REACTIVATION_RESPONSE - marca respondeu independente do conteudo. */
export async function markResponded(targetId: string): Promise<void> {
  const target = await reactivationRepository.findTargetById(targetId);
  if (!target || target.status === "responded" || target.status === "declined" || target.status === "converted") return;
  await reactivationMessageRepository.cancelPendingForTarget(targetId);
  await reactivationRepository.setTargetStatus(targetId, "responded", { responded_at: new Date().toISOString() });
  await reactivationEventRepository.record(targetId, "responded");
}
