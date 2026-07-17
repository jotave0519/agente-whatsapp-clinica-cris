import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as commercialEventRepository from "../repositories/commercialEventRepository";
import * as commercialFollowUpMessageRepository from "../repositories/commercialFollowUpMessageRepository";
import * as commercialOpportunityRepository from "../repositories/commercialOpportunityRepository";
import * as conversationRepository from "../repositories/conversationRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import * as userRepository from "../repositories/userRepository";
import { ClinicSettings, CommercialOpportunity, CommercialOpportunityStage, CommercialSignalType, Schedule } from "../types";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import * as aiKnowledgeService from "./aiKnowledgeService";
import * as businessHoursService from "./businessHoursService";
import { composeFollowUpMessage } from "./commercialMessageService";

const SCOPE = "commercialEngine";

/**
 * IA Comercial - detecta automaticamente pacientes que demonstraram interesse
 * num procedimento sem converter (pergunta de preco, agendamento abandonado,
 * avaliacao sem procedimento depois, "vou pensar"/"ta caro"/"vou viajar"/etc)
 * e faz acompanhamento contextual via WhatsApp. Mesmo padrao arquitetural dos
 * outros 3 motores desta sessao: config + fila de execucao com claim atomico
 * + eventos de auditoria, revalidando seguranca no momento do envio.
 *
 * Progressao de estagio deliberadamente NAO tem hook em schedulingService.ts
 * nem em scheduleController.ts (ver reactivationEngine.checkConversions, que
 * evita o mesmo por motivo identico) - tudo passa por checkOpportunityProgress,
 * chamada a cada minuto, que tambem cobre o caso de a recepcao nunca marcar o
 * desfecho manualmente (mesmo problema que o pos-atendimento ja resolveu com
 * varredura por tempo decorrido).
 */

function looksLikeEvaluation(procedure: string): boolean {
  return procedure.toLowerCase().includes("avalia");
}

function appointmentStart(schedule: Schedule): Date {
  return new Date(`${schedule.date}T${schedule.time.slice(0, 5)}:00-03:00`);
}

async function scheduleHasEnded(schedule: Schedule): Promise<boolean> {
  const durationMinutes = schedule.duration_minutes ?? (await aiKnowledgeService.findProcedureDuration(schedule.procedure)) ?? 30;
  const endTime = new Date(appointmentStart(schedule).getTime() + durationMinutes * 60_000);
  return endTime.getTime() <= Date.now();
}

function spDateIso(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function spTimeHHMM(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
}

function spDateTime(dateIso: string, hhmm: string): Date {
  return new Date(`${dateIso}T${hhmm}:00-03:00`);
}

function addDaysIso(dateIso: string, days: number): string {
  const ms = new Date(`${dateIso}T12:00:00-03:00`).getTime() + days * 24 * 3600_000;
  return spDateIso(new Date(ms));
}

/** Empurra pro proximo horario de funcionamento real da clinica (nunca madrugada, nunca fechado/almoco) - reaproveita businessHoursService, sem campos de config dedicados. */
async function clampToBusinessHours(date: Date): Promise<Date> {
  let cursor = date;
  for (let i = 0; i < 21; i += 1) {
    const dateIso = spDateIso(cursor);
    const hours = await businessHoursService.getDayHours(dateIso);
    if (!hours.enabled) {
      cursor = spDateTime(addDaysIso(dateIso, 1), "08:00");
      continue;
    }
    const hhmm = spTimeHHMM(cursor);
    if (hhmm < hours.open) return spDateTime(dateIso, hours.open);
    if (hhmm >= hours.close) {
      cursor = spDateTime(addDaysIso(dateIso, 1), "08:00");
      continue;
    }
    if (hours.lunchStart && hours.lunchEnd && hhmm >= hours.lunchStart && hhmm < hours.lunchEnd) {
      return spDateTime(dateIso, hours.lunchEnd);
    }
    return cursor;
  }
  return cursor;
}

async function scheduleNextFollowUp(opportunity: CommercialOpportunity, settings: ClinicSettings): Promise<void> {
  const target = new Date(Date.now() + settings.commercial_nudge_interval_days * 24 * 3600_000);
  const clamped = await clampToBusinessHours(target);
  await commercialFollowUpMessageRepository.insertPending(opportunity.id, clamped);
}

/** Chamado pela tool flag_opportunity (menu, e as 3 etapas de resposta a mensagem espontanea). */
export async function flagSignal(userId: string, procedure: string, signal: CommercialSignalType, note: string | null): Promise<void> {
  const { opportunity, created } = await commercialOpportunityRepository.createOpportunityIfMissing({
    userId,
    procedureInterest: procedure,
    sourceSignal: signal,
    signalNote: note,
  });

  if (created) {
    await commercialEventRepository.record(opportunity.id, "created", signal);
    logger.info(SCOPE, "Nova oportunidade comercial criada", { opportunityId: opportunity.id, userId, signal });
    return;
  }

  const mergedProcedure = opportunity.procedure_interest.toLowerCase().includes(procedure.toLowerCase())
    ? opportunity.procedure_interest
    : `${opportunity.procedure_interest}; ${procedure}`;
  await commercialOpportunityRepository.updateSignal(opportunity.id, mergedProcedure, note);
  await commercialEventRepository.record(opportunity.id, "signal_detected", `${signal}${note ? `: ${note}` : ""}`);
}

/** Chamado pelo hook em abandonFlow (shared.ts) e pelo bloco de expiracao por inatividade (engine.ts) - ambos ja filtram por estado SCHEDULING_* antes de chamar. */
export async function flagAbandonedScheduling(userId: string, procedure: string): Promise<void> {
  const { opportunity, created } = await commercialOpportunityRepository.createOpportunityIfMissing({
    userId,
    procedureInterest: procedure,
    sourceSignal: "abandoned_scheduling",
    signalNote: "Iniciou um agendamento mas nao concluiu.",
  });

  if (created) {
    await commercialEventRepository.record(opportunity.id, "created", "abandoned_scheduling");
    logger.info(SCOPE, "Oportunidade criada por abandono de agendamento", { opportunityId: opportunity.id, userId });
  } else {
    await commercialEventRepository.record(opportunity.id, "signal_detected", "abandoned_scheduling");
  }
}

/** Roda 1x/dia (ver commercialCron.ts) - rede de seguranca pra "fez avaliacao e nao voltou" quando nenhum outro gatilho capturou o sinal. */
export async function scanForMissedSignals(): Promise<{ created: number }> {
  const settings = await settingsRepository.getClinicSettings();
  if (!settings.commercial_ai_enabled) return { created: 0 };

  const rows = await scheduleRepository.findAllForSegmentation();
  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push(row);
  }

  let created = 0;
  for (const [userId, userRows] of byUser) {
    const last = userRows[userRows.length - 1];
    if (last.status !== "Concluido" || !looksLikeEvaluation(last.procedure)) continue;

    const daysSince = Math.floor((Date.now() - new Date(`${last.date}T12:00:00-03:00`).getTime()) / (24 * 3600_000));
    if (daysSince < settings.commercial_decision_grace_days) continue;

    const existing = await commercialOpportunityRepository.findActiveByUserId(userId);
    if (existing) continue;

    const user = await userRepository.findById(userId);
    if (!user || !user.active || user.do_not_contact) continue;

    const { opportunity, created: wasCreated } = await commercialOpportunityRepository.createOpportunityIfMissing({
      userId,
      procedureInterest: last.procedure,
      sourceSignal: "post_evaluation_no_procedure",
      signalNote: null,
    });
    if (wasCreated) {
      await commercialOpportunityRepository.setStage(opportunity.id, "awaiting_decision", { evaluation_at: `${last.date}T12:00:00-03:00` });
      await commercialEventRepository.record(opportunity.id, "created", "post_evaluation_no_procedure (varredura diaria)");
      created += 1;
    }
  }

  logger.info(SCOPE, "Varredura diaria de sinais perdidos concluida", { created });
  return { created };
}

/** Roda a cada minuto, ao fim de processDueMessages - progride/reverte estagio com base no estado real dos agendamentos, sem hook em schedulingService/scheduleController. */
export async function checkOpportunityProgress(): Promise<void> {
  const settings = await settingsRepository.getClinicSettings();
  const opportunities = await commercialOpportunityRepository.findNonTerminal();

  for (const opp of opportunities) {
    try {
      if (!opp.schedule_id) {
        const schedules = await scheduleRepository.findAllByUserId(opp.user_id);
        const newSchedule = schedules.find(
          (s) => s.status !== "Cancelado" && new Date(s.created_at).getTime() > new Date(opp.first_contact_at).getTime()
        );
        if (newSchedule) {
          const nextStage: CommercialOpportunityStage = looksLikeEvaluation(newSchedule.procedure) ? "evaluation_scheduled" : "procedure_scheduled";
          await commercialOpportunityRepository.linkSchedule(opp.id, newSchedule.id);
          await commercialOpportunityRepository.setStage(opp.id, nextStage);
          await commercialEventRepository.record(opp.id, "stage_changed", nextStage);
          continue;
        }
      }

      if (opp.schedule_id) {
        const schedule = await scheduleRepository.findScheduleById(opp.schedule_id);
        if (schedule) {
          if (schedule.status === "Cancelado" || schedule.status === "Faltou") {
            await commercialOpportunityRepository.clearSchedule(opp.id);
            await commercialOpportunityRepository.setStage(opp.id, "awaiting_decision");
            await commercialEventRepository.record(opp.id, "schedule_cancelled_or_noshow", schedule.status);
            continue;
          }

          const ended = schedule.status === "Concluido" || (await scheduleHasEnded(schedule));
          if (ended) {
            const isEval = looksLikeEvaluation(schedule.procedure);
            if (isEval && opp.stage === "evaluation_scheduled") {
              await commercialOpportunityRepository.setStage(opp.id, "evaluation_done", { evaluation_at: new Date().toISOString() });
              await commercialOpportunityRepository.clearSchedule(opp.id);
              await commercialEventRepository.record(opp.id, "stage_changed", "evaluation_done");
            } else if (!isEval && opp.stage === "procedure_scheduled") {
              const price = await aiKnowledgeService.findProcedurePrice(schedule.procedure);
              await commercialOpportunityRepository.setStage(opp.id, "converted", { estimated_value: price });
              await commercialFollowUpMessageRepository.cancelPendingForOpportunity(opp.id);
              await commercialEventRepository.record(opp.id, "converted", price != null ? String(price) : null);
            }
          }
        }
        continue;
      }

      if (opp.stage === "evaluation_done" && opp.evaluation_at) {
        const graceMs = settings.commercial_decision_grace_days * 24 * 3600_000;
        if (Date.now() - new Date(opp.evaluation_at).getTime() >= graceMs) {
          await commercialOpportunityRepository.setStage(opp.id, "awaiting_decision");
          await commercialEventRepository.record(opp.id, "stage_changed", "awaiting_decision");
        }
        continue;
      }

      // As transicoes acima (vincular/reverter agendamento) refletem o estado real
      // independente do toggle - o Kanban deve mostrar a verdade sempre. So a partir
      // daqui (agendar novas mensagens de follow-up) e que o toggle importa.
      if (!settings.commercial_ai_enabled) continue;

      if ((opp.stage === "new_interest" || opp.stage === "awaiting_decision") && !opp.paused) {
        const hasPending = await commercialFollowUpMessageRepository.hasPendingForOpportunity(opp.id);
        if (!hasPending) {
          await scheduleNextFollowUp(opp, settings);
          await commercialOpportunityRepository.setStage(opp.id, "follow_up_active");
          await commercialEventRepository.record(opp.id, "stage_changed", "follow_up_active");
        }
        continue;
      }

      if (opp.stage === "follow_up_active") {
        if (opp.attempts_used >= settings.commercial_max_attempts) {
          const hasPending = await commercialFollowUpMessageRepository.hasPendingForOpportunity(opp.id);
          if (!hasPending) {
            await commercialOpportunityRepository.setStage(opp.id, "lost");
            await commercialEventRepository.record(opp.id, "lost", "tentativas esgotadas");
          }
          continue;
        }
        if (opp.paused) {
          const conversation = await conversationRepository.findActiveConversation(opp.user_id);
          if (!conversation || conversation.status === "closed") {
            await scheduleNextFollowUp(opp, settings);
            await commercialOpportunityRepository.setPaused(opp.id, false);
            await commercialEventRepository.record(opp.id, "stage_changed", "novo ciclo de follow-up agendado apos pausa");
          }
        }
      }
    } catch (err) {
      logger.error(SCOPE, "Falha ao processar progresso de uma oportunidade comercial", { opportunityId: opp.id, err });
    }
  }
}

/** Roda a cada minuto. Processa mensagens vencidas, revalidando seguranca no momento do envio. */
export async function processDueMessages(): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const settings = await settingsRepository.getClinicSettings();
  const due = await commercialFollowUpMessageRepository.findDue(50);

  for (const message of due) {
    const claimed = await commercialFollowUpMessageRepository.claim(message.id);
    if (!claimed) continue;

    try {
      const opportunity = await commercialOpportunityRepository.findById(message.opportunity_id);
      const eligibleStages: CommercialOpportunityStage[] = ["new_interest", "awaiting_decision", "follow_up_active"];
      if (!opportunity || !eligibleStages.includes(opportunity.stage) || opportunity.paused || !settings.commercial_ai_enabled) {
        await commercialFollowUpMessageRepository.markCancelled(message.id);
        skipped += 1;
        continue;
      }

      const user = await userRepository.findById(opportunity.user_id);
      if (!user || !user.phone) {
        await commercialFollowUpMessageRepository.markFailed(message.id, "Paciente sem telefone");
        failed += 1;
        continue;
      }
      if (!user.active || user.do_not_contact) {
        await commercialFollowUpMessageRepository.markCancelled(message.id);
        skipped += 1;
        continue;
      }

      const conversation = await conversationRepository.findActiveConversation(opportunity.user_id);
      if (conversation && conversation.status !== "closed") {
        await commercialFollowUpMessageRepository.postpone(message.id, message.postpone_count, new Date(Date.now() + 2 * 3600_000));
        skipped += 1;
        continue;
      }

      const daysSinceSignal = Math.floor((Date.now() - new Date(opportunity.first_contact_at).getTime()) / (24 * 3600_000));
      const composed = await composeFollowUpMessage({
        firstName: (user.name || "").split(" ")[0] || "Olá",
        procedureInterest: opportunity.procedure_interest,
        sourceSignal: opportunity.source_signal,
        signalNote: opportunity.signal_note,
        daysSinceSignal,
        attemptNumber: opportunity.attempts_used + 1,
      });
      if (!composed) {
        await commercialFollowUpMessageRepository.markFailedOrRetry(message.id, message.attempts, "Falha ao compor mensagem (Claude)");
        failed += 1;
        continue;
      }

      await withRetry(() => sendWhatsAppMessage(user.phone, composed), 1, 400);
      // Marcado ANTES de qualquer outra escrita - garante que uma falha no
      // bookkeeping abaixo nunca causa reenvio no proximo tick.
      await commercialFollowUpMessageRepository.markSent(message.id, composed);
      sent += 1;

      try {
        await commercialOpportunityRepository.incrementAttempts(opportunity.id, opportunity.attempts_used);
        await commercialOpportunityRepository.setMessageSent(opportunity.id, composed);
        await commercialEventRepository.record(opportunity.id, "message_sent");

        const conv = await conversationRepository.findOrCreateActiveConversation(opportunity.user_id);
        await conversationRepository.addMessage(conv.id, "assistant", composed, true);
        await conversationRepository.touchUserActivity(conv.id, true);
        await conversationRepository.updateConversationFlow(conv.id, "COMMERCIAL_FOLLOWUP_RESPONSE", {
          commercialOpportunityId: opportunity.id,
          commercialProcedureInterest: opportunity.procedure_interest,
        });
      } catch (bookkeepErr) {
        logger.error(SCOPE, "Mensagem comercial enviada, mas falha no bookkeeping", bookkeepErr);
      }
    } catch (err) {
      logger.error(SCOPE, "Falha ao processar mensagem comercial", err);
      await commercialFollowUpMessageRepository.markFailedOrRetry(message.id, message.attempts, err instanceof Error ? err.message : String(err));
      failed += 1;
    }
  }

  await checkOpportunityProgress();

  return { sent, skipped, failed };
}

/** Chamado pelo webhookController assim que uma mensagem chega numa conversa em COMMERCIAL_FOLLOWUP_RESPONSE - pausa a campanha imediatamente, independente do que a Claude decidir fazer com o conteudo. */
export async function markResponded(opportunityId: string, responseText: string): Promise<void> {
  const opportunity = await commercialOpportunityRepository.findById(opportunityId);
  if (!opportunity) return;
  await commercialFollowUpMessageRepository.cancelPendingForOpportunity(opportunityId);
  await commercialOpportunityRepository.setResponse(opportunityId, responseText);
  await commercialOpportunityRepository.setPaused(opportunityId, true);
  await commercialEventRepository.record(opportunityId, "responded", responseText.slice(0, 200));
}

/** Chamado pelo step COMMERCIAL_FOLLOWUP_RESPONSE quando o paciente pede pra nao receber mais contato. */
export async function stopContact(opportunityId: string): Promise<void> {
  await commercialFollowUpMessageRepository.cancelPendingForOpportunity(opportunityId);
  await commercialOpportunityRepository.setStage(opportunityId, "lost");
  await commercialEventRepository.record(opportunityId, "lost", "paciente pediu para nao receber mais contato");
}

/** Chamado pela tela Oportunidades (menu "mover para..."). */
export async function moveStageManually(opportunityId: string, newStage: CommercialOpportunityStage): Promise<void> {
  await commercialOpportunityRepository.setStage(opportunityId, newStage);
  await commercialEventRepository.record(opportunityId, "moved_manually", newStage);
}

/** Chamado pela tela Oportunidades (pausar/retomar automacao manualmente). */
export async function setPausedManually(opportunityId: string, paused: boolean): Promise<void> {
  await commercialOpportunityRepository.setPaused(opportunityId, paused);
  // Em ambos os casos cancela o que estava pendente: pausar para de enviar; retomar forca o
  // checkOpportunityProgress a reagendar do zero no proximo tick, respeitando horario comercial.
  await commercialFollowUpMessageRepository.cancelPendingForOpportunity(opportunityId);
  await commercialEventRepository.record(opportunityId, "moved_manually", paused ? "pausado manualmente" : "retomado manualmente");
}
