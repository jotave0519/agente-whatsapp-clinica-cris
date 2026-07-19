import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as conversationRepository from "../repositories/conversationRepository";
import * as postAttendanceEventRepository from "../repositories/postAttendanceEventRepository";
import * as postAttendanceMessageRepository from "../repositories/postAttendanceMessageRepository";
import * as postAttendanceRepository from "../repositories/postAttendanceRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import * as userRepository from "../repositories/userRepository";
import { PostAttendanceFlowMessage, PostAttendanceTriggerSource, Schedule } from "../types";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import * as aiKnowledgeService from "./aiKnowledgeService";
import { composeFollowUpMessage, FollowUpContext } from "./postAttendanceMessageService";

const SCOPE = "postAttendanceEngine";

/**
 * IA de pos-atendimento - matricula automaticamente todo agendamento
 * concluido (marcacao manual OU horario ja passado) num fluxo configurado
 * pela clinica, e manda cada mensagem da sequencia composta pela Claude com o
 * historico real do paciente. Mesmo padrao arquitetural dos outros dois
 * motores desta sessao (confirmacao de consulta, reativacao de pacientes):
 * tabela de config + fila de execucao com claim atomico + eventos de
 * auditoria, revalidando seguranca no momento do envio (nao so na matricula).
 */

function appointmentStart(schedule: Schedule): Date {
  return new Date(`${schedule.date}T${schedule.time.slice(0, 5)}:00-03:00`);
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(`${dateStr}T12:00:00-03:00`).getTime()) / (24 * 3600 * 1000));
}

function formatDateBr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function toSaoPauloParts(date: Date): { year: number; month: number; day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parseInt(parts.hour, 10);
  return { year: parseInt(parts.year, 10), month: parseInt(parts.month, 10), day: parseInt(parts.day, 10), hour: hour === 24 ? 0 : hour };
}

function spDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00-03:00`);
}

/** Nunca envia de madrugada, independente do horario comercial (variavel) da clinica - janela de bom senso fixa. */
function clampToSafeWindow(date: Date): Date {
  const p = toSaoPauloParts(date);
  if (p.hour < 8) return spDate(p.year, p.month, p.day, 8, 0);
  if (p.hour >= 20) return new Date(spDate(p.year, p.month, p.day, 8, 0).getTime() + 24 * 3600_000);
  return date;
}

/**
 * Se o paciente ja tem 3+ respostas anteriores registradas, desloca a HORA
 * (nunca a data) pro balde do dia (manha/tarde/noite) em que ele mais
 * respondeu - sempre dentro do clamp de horario seguro. Usa baldes em vez de
 * media aritmetica de propósito: media circular de horarios e um bug classico
 * (23h + 01h nao pode virar meio-dia).
 */
async function biasHourIfLearned(date: Date, userId: string): Promise<Date> {
  const hours = await postAttendanceEventRepository.findRespondedHoursForUser(userId);
  if (hours.length < 3) return date;

  const buckets = { morning: 0, afternoon: 0, evening: 0 };
  for (const h of hours) {
    if (h < 12) buckets.morning += 1;
    else if (h < 18) buckets.afternoon += 1;
    else buckets.evening += 1;
  }
  const top = (Object.entries(buckets) as [keyof typeof buckets, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const targetHour = top === "morning" ? 10 : top === "afternoon" ? 15 : 19;

  const p = toSaoPauloParts(date);
  return spDate(p.year, p.month, p.day, targetHour, 0);
}

/** Matricula um agendamento no fluxo aplicavel (por procedimento, ou o generico 'all') - idempotente via unique(schedule_id). */
export async function enrollSchedule(schedule: Schedule, triggerSource: PostAttendanceTriggerSource): Promise<void> {
  const settings = await settingsRepository.getClinicSettings();
  if (!settings.post_attendance_enabled) return;

  const flow = await postAttendanceRepository.findFlowByProcedure(schedule.procedure);
  if (!flow) return; // nenhum fluxo configurado pra esse procedimento (nem um 'all' generico) - nada a fazer

  const enrollment = await postAttendanceRepository.createEnrollmentIfMissing({
    scheduleId: schedule.id,
    flowId: flow.id,
    userId: schedule.user_id,
    triggerSource,
  });
  if (!enrollment) return; // ja matriculado (corrida entre o hook manual e o cron de tempo-decorrido)

  await postAttendanceEventRepository.record(enrollment.id, "enrolled", triggerSource);

  const durationMinutes = schedule.duration_minutes ?? (await aiKnowledgeService.findProcedureDuration(schedule.procedure)) ?? 30;
  const endTime = new Date(appointmentStart(schedule).getTime() + durationMinutes * 60_000);

  const flowMessages = await postAttendanceRepository.listFlowMessages(flow.id);
  if (flowMessages.length === 0) return;

  const rows: { enrollmentId: string; flowMessageId: string; scheduledFor: Date }[] = [];
  for (const fm of flowMessages) {
    const delayMs = fm.delay_value * (fm.delay_unit === "hours" ? 3600_000 : 24 * 3600_000);
    // scheduled_for de cada mensagem e ancorado ao FIM DA CONSULTA, sempre
    // independente das outras - um postpone numa mensagem nunca empurra as
    // seguintes da mesma sequencia.
    let scheduledFor = clampToSafeWindow(new Date(endTime.getTime() + delayMs));
    scheduledFor = await biasHourIfLearned(scheduledFor, schedule.user_id);
    rows.push({ enrollmentId: enrollment.id, flowMessageId: fm.id, scheduledFor });
  }
  await postAttendanceMessageRepository.insertPending(rows);
  logger.info(SCOPE, "Paciente matriculado em fluxo de pos-atendimento", { enrollmentId: enrollment.id, flowId: flow.id, triggerSource, messages: rows.length });
}

/** Roda a cada 15 min (ver postAttendanceCron.ts) - detecta consultas cujo horario passou sem ninguem marcar o desfecho manualmente. */
export async function scanTimeElapsedSchedules(): Promise<{ enrolled: number }> {
  const candidates = await scheduleRepository.findRecentAgendadoForPostAttendanceScan(14);
  let enrolled = 0;

  for (const schedule of candidates) {
    const already = await postAttendanceRepository.findEnrollmentByScheduleId(schedule.id);
    if (already) continue;

    const durationMinutes = schedule.duration_minutes ?? (await aiKnowledgeService.findProcedureDuration(schedule.procedure)) ?? 30;
    const endTime = new Date(appointmentStart(schedule).getTime() + durationMinutes * 60_000);
    if (endTime.getTime() > Date.now()) continue; // ainda nao terminou

    await enrollSchedule(schedule, "time_elapsed");
    enrolled += 1;
  }

  return { enrolled };
}

async function buildFollowUpContext(schedule: Schedule, flowMessage: PostAttendanceFlowMessage): Promise<FollowUpContext> {
  const user = await userRepository.findById(schedule.user_id);
  const allSchedules = await scheduleRepository.findAllByUserId(schedule.user_id);
  const totalVisits = allSchedules.filter((s) => s.status === "Concluido").length;

  return {
    firstName: (user?.name || schedule.patient_name || "").split(" ")[0] || "Olá",
    procedure: schedule.procedure,
    visitDate: formatDateBr(schedule.date),
    daysSinceVisit: daysSince(schedule.date),
    totalVisits,
    messageType: flowMessage.message_type,
    styleInstruction: flowMessage.body,
  };
}

/** Roda a cada minuto (ver postAttendanceCron.ts). Processa mensagens vencidas, revalidando seguranca no momento do envio. */
export async function processDueMessages(): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const due = await postAttendanceMessageRepository.findDue(50);

  for (const message of due) {
    const claimed = await postAttendanceMessageRepository.claim(message.id);
    if (!claimed) continue;

    try {
      const enrollment = await postAttendanceRepository.findEnrollmentById(message.enrollment_id);
      if (!enrollment || enrollment.status !== "active") {
        await postAttendanceMessageRepository.markCancelled(message.id);
        skipped += 1;
        continue;
      }

      const schedule = await scheduleRepository.findScheduleById(enrollment.schedule_id);
      if (!schedule || schedule.status === "Cancelado" || schedule.status === "Faltou") {
        await postAttendanceMessageRepository.markCancelled(message.id);
        await postAttendanceRepository.setEnrollmentStatus(enrollment.id, "interrupted");
        await postAttendanceEventRepository.record(enrollment.id, "skipped_schedule_status_changed", schedule?.status ?? "nao encontrado");
        skipped += 1;
        continue;
      }

      const flowMessage = await postAttendanceRepository.findFlowMessageById(message.flow_message_id);
      if (!flowMessage) {
        await postAttendanceMessageRepository.markCancelled(message.id);
        skipped += 1;
        continue;
      }

      const user = await userRepository.findById(enrollment.user_id);
      if (!user || !user.phone) {
        await postAttendanceMessageRepository.markFailed(message.id, "Paciente sem telefone");
        failed += 1;
        continue;
      }
      if (user.do_not_contact) {
        await postAttendanceMessageRepository.markCancelled(message.id);
        skipped += 1;
        continue;
      }

      // Conversa ativa agora - nao interrompe, so adia (nao e uma falha).
      const conversation = await conversationRepository.findActiveConversation(enrollment.user_id);
      if (conversation && conversation.status !== "closed") {
        await postAttendanceMessageRepository.postpone(message.id, message.postpone_count, new Date(Date.now() + 2 * 3600_000));
        await postAttendanceEventRepository.record(enrollment.id, "skipped_conversation_busy");
        skipped += 1;
        continue;
      }

      if (flowMessage.message_type === "reminder") {
        const futureAppointments = await scheduleRepository.findActiveSchedulesByUser(enrollment.user_id);
        const today = new Date().toISOString().slice(0, 10);
        if (futureAppointments.some((s) => s.date >= today)) {
          await postAttendanceMessageRepository.markCancelled(message.id);
          await postAttendanceEventRepository.record(enrollment.id, "skipped_future_appointment");
          skipped += 1;
          continue;
        }
      }

      let reviewLink: string | null = null;
      if (flowMessage.message_type === "review") {
        const settings = await settingsRepository.getClinicSettings();
        if (!settings.google_review_link) {
          await postAttendanceMessageRepository.markFailed(message.id, "Link de avaliacao do Google nao configurado");
          await postAttendanceEventRepository.record(enrollment.id, "skipped_no_link");
          failed += 1;
          continue;
        }
        reviewLink = settings.google_review_link;
      }

      const ctx = await buildFollowUpContext(schedule, flowMessage);
      const composed = await composeFollowUpMessage(ctx);
      if (!composed) {
        await postAttendanceMessageRepository.markFailedOrRetry(message.id, message.attempts, "Falha ao compor mensagem (Claude)");
        failed += 1;
        continue;
      }

      const text = reviewLink ? `${composed}\n\n${reviewLink}` : composed;

      await withRetry(() => sendWhatsAppMessage(user.phone, text), 1, 400);
      // Marcado ANTES de qualquer outra escrita - garante que uma falha no
      // bookkeeping abaixo nunca causa reenvio no proximo tick.
      await postAttendanceMessageRepository.markSent(message.id, text);
      sent += 1;

      try {
        await postAttendanceEventRepository.record(enrollment.id, flowMessage.message_type === "review" ? "review_requested" : "message_sent");

        const conv = await conversationRepository.findOrCreateActiveConversation(enrollment.user_id);
        await conversationRepository.addMessage(conv.id, "assistant", text, true);
        await conversationRepository.touchUserActivity(conv.id, true);
        await conversationRepository.updateConversationFlow(conv.id, "POST_ATTENDANCE_RESPONSE", {
          postAttendanceEnrollmentId: enrollment.id,
        });

        const stillPending = await postAttendanceMessageRepository.hasPendingForEnrollment(enrollment.id);
        if (!stillPending) {
          await postAttendanceRepository.setEnrollmentStatus(enrollment.id, "completed");
          await postAttendanceEventRepository.record(enrollment.id, "completed");
        }
      } catch (bookkeepErr) {
        logger.error(SCOPE, "Mensagem de pos-atendimento enviada, mas falha no bookkeeping", bookkeepErr);
      }
    } catch (err) {
      logger.error(SCOPE, "Falha ao processar mensagem de pos-atendimento", err);
      await postAttendanceMessageRepository.markFailedOrRetry(message.id, message.attempts, err instanceof Error ? err.message : String(err));
      failed += 1;
    }
  }

  return { sent, skipped, failed };
}

/** Chamado pelo webhookController assim que uma mensagem chega numa conversa em POST_ATTENDANCE_RESPONSE - so registra o evento, NUNCA cancela a fila (diferente da reativacao: uma resposta ao check-in de 2h nao pode apagar o lembrete de 30 dias). */
export async function markResponded(enrollmentId: string): Promise<void> {
  const enrollment = await postAttendanceRepository.findEnrollmentById(enrollmentId);
  if (!enrollment || enrollment.status !== "active") return;
  await postAttendanceEventRepository.record(enrollmentId, "responded");
}

/** Chamado pelo step POST_ATTENDANCE_RESPONSE quando a Claude detecta um possivel sinal de complicacao (tool flag_concern). */
export async function flagConcern(enrollmentId: string, reason: string): Promise<void> {
  await postAttendanceMessageRepository.cancelPendingForEnrollment(enrollmentId);
  await postAttendanceRepository.setEnrollmentStatus(enrollmentId, "transferred");
  await postAttendanceEventRepository.record(enrollmentId, "alert_raised", reason);
  await postAttendanceEventRepository.record(enrollmentId, "transferred");
}

/** Chamado pelo step POST_ATTENDANCE_RESPONSE quando o paciente pede explicitamente pra nao receber mais os check-ins. */
export async function stopFollowup(enrollmentId: string): Promise<void> {
  await postAttendanceMessageRepository.cancelPendingForEnrollment(enrollmentId);
  await postAttendanceRepository.setEnrollmentStatus(enrollmentId, "interrupted");
  await postAttendanceEventRepository.record(enrollmentId, "interrupted");
}

const CONCERN_KEYWORDS = [/\bdor\b/i, /inchaco/i, /inchada/i, /inchado/i, /sangr/i, /vermelh/i, /febre/i, /infecc/i, /complicac/i, /urgente/i];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Rede de seguranca deterministica (NAO substitui a tool flag_concern, que e
 * a deteccao primaria via Claude) - usada pelo webhookController como
 * fail-safe: se o texto bate com essas palavras-chave E a Claude nao escalou
 * nada nesse turno, forca a sinalizacao mesmo assim. Dado que e saude, vies
 * para over-trigger e a escolha certa.
 */
export function looksLikeClinicalConcern(text: string): boolean {
  const normalized = normalize(text);
  return CONCERN_KEYWORDS.some((pattern) => pattern.test(normalized));
}

/** Chamado pelo webhookController quando o fail-safe deterministico dispara (Claude nao chamou flag_concern nesse turno). */
export async function recordFailsafeAlert(enrollmentId: string): Promise<void> {
  await postAttendanceEventRepository.record(enrollmentId, "alert_raised_failsafe");
}
