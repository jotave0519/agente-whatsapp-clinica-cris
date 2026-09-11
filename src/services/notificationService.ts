import webpush from "web-push";
import { env } from "../config/env";
import * as notificationRepository from "../repositories/notificationRepository";
import * as pushSubscriptionRepository from "../repositories/pushSubscriptionRepository";
import { Schedule } from "../types";
import { logger } from "../utils/logger";

const SCOPE = "notificationService";

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  const subject = env.vapidContactUrl.startsWith("http") ? env.vapidContactUrl : `mailto:${env.vapidContactUrl}`;
  webpush.setVapidDetails(subject, env.vapidPublicKey, env.vapidPrivateKey);
  vapidConfigured = true;
  return true;
}

/** "Hoje"/"Amanhã"/dia+mes - mesmo padrao usado no frontend da Agenda, replicado aqui pro texto da notificacao. */
function dayLabel(dateStr: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (dateStr === today) return "Hoje";
  const tomorrow = new Date(`${today}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().slice(0, 10)) return "Amanhã";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

/**
 * Unica notificacao do sistema: o lembrete de atendimento proximo. Criar,
 * remarcar e cancelar continuam so registrados normalmente na Agenda - nunca
 * geram push, pra nao transformar a agenda numa sequencia de alertas.
 */
export function buildReminderMessage(
  schedule: Pick<Schedule, "patient_name" | "procedure" | "date" | "time">,
  minutesBefore: number
): { title: string; body: string } {
  const time = schedule.time.slice(0, 5);
  const when = `${dayLabel(schedule.date)} às ${time}`;
  return {
    title: `🔔 Atendimento em ${minutesBefore} minutos`,
    body: `${schedule.patient_name} — ${schedule.procedure}\n${when}`,
  };
}

/**
 * Envia o lembrete de atendimento pra UMA pessoa da equipe - sempre grava na
 * central in-app; o push real so sai se VAPID estiver configurado e ela
 * tiver pelo menos um dispositivo inscrito. Nunca lanca erro pro chamador:
 * notificar e sempre best-effort, uma falha aqui nao pode quebrar o cron.
 */
export async function notifyReminder(params: { staffId: string; title: string; body: string; scheduleId: string }): Promise<void> {
  try {
    await notificationRepository.create({
      staffId: params.staffId,
      type: "reminder",
      title: params.title,
      body: params.body,
      scheduleId: params.scheduleId,
    });

    await sendPush(params.staffId, params.title, params.body, params.scheduleId);
  } catch (err) {
    logger.error(SCOPE, "Falha ao notificar lembrete", { staffId: params.staffId, scheduleId: params.scheduleId, error: err });
  }
}

async function sendPush(staffId: string, title: string, body: string, scheduleId?: string | null): Promise<void> {
  if (!ensureVapid()) return; // VAPID ainda nao configurado neste ambiente - so a notificacao in-app fica registrada
  const subs = await pushSubscriptionRepository.findByStaffId(staffId);
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, scheduleId: scheduleId ?? null });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err: any) {
        // 404/410 = inscricao expirada/revogada (desinstalou o app, trocou de navegador
        // etc.) - remove pra nunca mais tentar enviar pra um endpoint morto.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await pushSubscriptionRepository.removeByEndpoint(sub.endpoint).catch(() => {});
        } else {
          logger.error(SCOPE, "Falha ao enviar push", { staffId, statusCode: err?.statusCode, error: err?.message });
        }
      }
    })
  );
}
