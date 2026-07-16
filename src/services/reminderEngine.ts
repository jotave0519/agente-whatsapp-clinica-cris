import * as googleCalendar from "../integrations/googleCalendarClient";
import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as conversationRepository from "../repositories/conversationRepository";
import * as reminderRepository from "../repositories/reminderRepository";
import * as scheduleEventRepository from "../repositories/scheduleEventRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import * as userRepository from "../repositories/userRepository";
import { ClinicSettings, Schedule } from "../types";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import * as aiKnowledgeService from "./aiKnowledgeService";

const SCOPE = "reminderEngine";

/**
 * Motor de confirmacao automatica de consultas - agenda um pedido de
 * confirmacao (horario configuravel em clinic_settings.confirmation_hours_before)
 * sempre que um agendamento e criado/cancelado/remarcado (chamado a partir de
 * src/services/schedulingService.ts, o unico lugar que escreve na tabela
 * schedules, cobrindo CRM e IA ao mesmo tempo). Se o paciente nao responder,
 * gera lembretes de nao-resposta (quantidade/intervalo configuraveis) na hora
 * em que o pedido de confirmacao e efetivamente enviado - nao na criacao do
 * agendamento, ja que so faz sentido cutucar depois que o primeiro pedido foi
 * mandado e ficou sem resposta.
 *
 * Pensado para servir de molde a futuras automacoes (reativacao de clientes,
 * pos-atendimento, campanhas): o padrao "tabela dedicada + status pending/
 * sending/sent/cancelled/failed + claim atomico + processDue no cron" pode
 * ser repetido com uma nova tabela quando essas automacoes existirem de
 * verdade - nao construir uma fila generica agora sem necessidade concreta.
 */

const CONFIRMATION_TIER = "confirmation";

function appointmentStart(schedule: Schedule): Date {
  return new Date(`${schedule.date}T${schedule.time.slice(0, 5)}:00-03:00`);
}

function formatDateParts(dateStr: string): { dataFmt: string; diaSemana: string } {
  const date = new Date(`${dateStr}T12:00:00-03:00`);
  const diaSemana = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
  const [, month, day] = dateStr.split("-");
  return { dataFmt: `${day}/${month}`, diaSemana };
}

async function buildTemplateText(key: string, schedule: Schedule): Promise<string> {
  const { dataFmt, diaSemana } = formatDateParts(schedule.date);
  return aiKnowledgeService.getMessageTemplate(key, {
    nome: schedule.patient_name.split(" ")[0],
    procedimento: schedule.procedure,
    data: dataFmt,
    hora: schedule.time.slice(0, 5),
    dia_semana: diaSemana,
  });
}

/** Chamado por schedulingService.createAppointment logo apos a criacao ter sucesso. */
export async function scheduleConfirmationForAppointment(schedule: Schedule): Promise<void> {
  await scheduleEventRepository.record(schedule.id, "created");

  const settings = await settingsRepository.getClinicSettings();
  if (!settings.confirmation_enabled) return;

  const scheduledFor = new Date(appointmentStart(schedule).getTime() - settings.confirmation_hours_before * 3600_000);
  if (scheduledFor.getTime() <= Date.now()) return; // consulta ja esta a menos horas de distancia do que o configurado

  await reminderRepository.insertPending([{ scheduleId: schedule.id, tier: CONFIRMATION_TIER, scheduledFor }]);
  logger.info(SCOPE, "Pedido de confirmacao agendado", { scheduleId: schedule.id, scheduledFor });
}

/** Chamado por schedulingService.cancelAppointment logo apos o cancelamento ter sucesso. */
export async function cancelRemindersForAppointment(scheduleId: string): Promise<void> {
  await reminderRepository.cancelPendingForSchedule(scheduleId);
}

/** Chamado por schedulingService.rescheduleAppointment - nunca mantem lembrete antigo para o horario anterior. */
export async function rescheduleRemindersForAppointment(schedule: Schedule): Promise<void> {
  await cancelRemindersForAppointment(schedule.id);
  await scheduleEventRepository.record(schedule.id, "rescheduled");

  const settings = await settingsRepository.getClinicSettings();
  if (!settings.confirmation_enabled) return;

  const scheduledFor = new Date(appointmentStart(schedule).getTime() - settings.confirmation_hours_before * 3600_000);
  if (scheduledFor.getTime() <= Date.now()) return;

  await reminderRepository.insertPending([{ scheduleId: schedule.id, tier: CONFIRMATION_TIER, scheduledFor }]);
}

/** Chamado pelo step REMINDER_RESPONSE quando o paciente confirma presenca. */
export async function confirmAppointment(scheduleId: string): Promise<void> {
  const schedule = await scheduleRepository.markConfirmedNow(scheduleId);
  await cancelRemindersForAppointment(scheduleId);
  await scheduleEventRepository.record(scheduleId, "confirmed");

  if (schedule.google_event_id) {
    try {
      const confirmedLabel = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const description =
        `Paciente: ${schedule.patient_name}\nTelefone: ${schedule.phone}\nProcedimento: ${schedule.procedure}` +
        (schedule.notes ? `\nObservacoes: ${schedule.notes}` : "") +
        `\nStatus: CONFIRMADO em ${confirmedLabel}`;
      await googleCalendar.updateEventDetails(schedule.google_event_id, {
        summary: `✅ ${schedule.procedure} - ${schedule.patient_name}`,
        description,
      });
    } catch (err) {
      logger.error(SCOPE, "Falha ao sincronizar confirmacao com o Google Calendar (confirmacao ja registrada no banco)", err);
    }
  }
}

async function scheduleNudges(schedule: Schedule, settings: ClinicSettings, from: Date): Promise<void> {
  if (!settings.confirmation_nudges_enabled) return;
  const apptStart = appointmentStart(schedule);
  const rows = [];
  for (let i = 1; i <= settings.confirmation_nudge_count; i += 1) {
    const scheduledFor = new Date(from.getTime() + i * settings.confirmation_nudge_interval_hours * 3600_000);
    if (scheduledFor.getTime() < apptStart.getTime()) {
      rows.push({ scheduleId: schedule.id, tier: `nudge_${i}`, scheduledFor });
    }
  }
  if (rows.length > 0) await reminderRepository.insertPending(rows);
}

/** Roda a cada minuto (ver reminderEngineCron.ts) - processa um lote de lembretes vencidos. */
export async function processDueReminders(): Promise<{ sent: number; skipped: number; failed: number }> {
  const due = await reminderRepository.findDue(50);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  if (due.length === 0) return { sent, skipped, failed };

  const settings = await settingsRepository.getClinicSettings();

  for (const row of due) {
    const claimed = await reminderRepository.claim(row.id);
    if (!claimed) continue; // outro worker ja pegou essa linha

    const isConfirmationTier = row.tier === CONFIRMATION_TIER;

    try {
      const schedule = await scheduleRepository.findScheduleById(row.schedule_id);
      const user = schedule ? await userRepository.findById(schedule.user_id) : null;
      const apptStart = schedule ? appointmentStart(schedule) : null;

      const shouldSkip =
        !schedule ||
        schedule.status !== "Agendado" ||
        !user ||
        !user.active ||
        !apptStart ||
        apptStart.getTime() <= Date.now() ||
        (isConfirmationTier && (!settings.confirmation_enabled || schedule.confirmation_status !== "pending")) ||
        (!isConfirmationTier && (!settings.confirmation_nudges_enabled || schedule.confirmation_status !== "awaiting"));

      if (shouldSkip) {
        await reminderRepository.markCancelled(row.id);
        skipped += 1;
        continue;
      }

      if (!schedule!.phone) {
        await reminderRepository.markFailed(row.id, "Agendamento sem telefone");
        failed += 1;
        continue;
      }

      const text = await buildTemplateText(isConfirmationTier ? "confirmation_request" : "confirmation_nudge", schedule!);
      await withRetry(() => sendWhatsAppMessage(schedule!.phone, text), 1, 400);
      // Marcado ANTES de qualquer outra escrita: garante que uma falha no
      // bookkeeping abaixo nunca causa reenvio da mensagem no proximo tick.
      await reminderRepository.markSent(row.id);
      sent += 1;

      const sentAt = new Date();
      try {
        if (isConfirmationTier) {
          await scheduleRepository.setConfirmationStatus(schedule!.id, "awaiting");
          await scheduleEventRepository.record(schedule!.id, "confirmation_sent");
          await scheduleNudges(schedule!, settings, sentAt);
        } else {
          await scheduleEventRepository.record(schedule!.id, "nudge_sent", row.tier);
        }

        const conversation = await conversationRepository.findOrCreateActiveConversation(schedule!.user_id);
        await conversationRepository.addMessage(conversation.id, "assistant", text, true);
        await conversationRepository.touchUserActivity(conversation.id, true);
        await conversationRepository.updateConversationFlow(conversation.id, "REMINDER_RESPONSE", {
          scheduleId: schedule!.id,
          procedure: schedule!.procedure,
          name: schedule!.patient_name,
          date: schedule!.date,
          time: schedule!.time,
        });
      } catch (bookkeepErr) {
        logger.error(SCOPE, "Lembrete enviado, mas falha no bookkeeping (status/conversa)", bookkeepErr);
      }
    } catch (err) {
      logger.error(SCOPE, "Falha ao processar lembrete", err);
      await reminderRepository.markFailedOrRetry(row.id, row.attempts, err instanceof Error ? err.message : String(err));
      failed += 1;
    }
  }

  return { sent, skipped, failed };
}
