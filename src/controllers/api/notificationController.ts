import { Request, Response } from "express";
import { env } from "../../config/env";
import * as notificationRepository from "../../repositories/notificationRepository";
import * as notificationSettingsRepository from "../../repositories/notificationSettingsRepository";
import * as pushSubscriptionRepository from "../../repositories/pushSubscriptionRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.notifications";

/** Chave publica VAPID - o frontend usa pra pushManager.subscribe(). Vazia se o backend ainda nao tiver as chaves configuradas. */
export function getVapidPublicKey(_req: Request, res: Response): void {
  res.json({ publicKey: env.vapidPublicKey || null });
}

export async function subscribe(req: Request, res: Response): Promise<void> {
  try {
    const { endpoint, keys, userAgent } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: "endpoint e keys (p256dh, auth) sao obrigatorios." });
      return;
    }

    const staffId = req.staff!.id;
    const sub = await pushSubscriptionRepository.upsert({
      staffId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    });
    res.status(201).json(sub);
  } catch (err) {
    logger.error(SCOPE, "Erro ao salvar inscricao push", err);
    res.status(500).json({ error: "Erro ao salvar inscricao push." });
  }
}

export async function unsubscribe(req: Request, res: Response): Promise<void> {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: "endpoint e obrigatorio." });
      return;
    }
    await pushSubscriptionRepository.removeByEndpoint(endpoint);
    res.json({ status: "removed" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao remover inscricao push", err);
    res.status(500).json({ error: "Erro ao remover inscricao push." });
  }
}

export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.staff!.id;
    const items = await notificationRepository.listByStaffId(staffId);
    const unreadCount = await notificationRepository.countUnread(staffId);
    res.json({ items, unreadCount });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar notificacoes", err);
    res.status(500).json({ error: "Erro ao listar notificacoes." });
  }
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    await notificationRepository.markRead(req.params.id);
    res.json({ status: "read" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao marcar notificacao como lida", err);
    res.status(500).json({ error: "Erro ao marcar notificacao como lida." });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    await notificationRepository.markAllRead(req.staff!.id);
    res.json({ status: "read" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao marcar notificacoes como lidas", err);
    res.status(500).json({ error: "Erro ao marcar notificacoes como lidas." });
  }
}

export async function getNotificationSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await notificationSettingsRepository.findByStaffId(req.staff!.id);
    res.json(settings);
  } catch (err) {
    logger.error(SCOPE, "Erro ao buscar preferencias de notificacao", err);
    res.status(500).json({ error: "Erro ao buscar preferencias de notificacao." });
  }
}

export async function updateNotificationSettings(req: Request, res: Response): Promise<void> {
  try {
    const { reminders_enabled, reminder_minutes_before, new_appointment_enabled, changes_enabled, cancellations_enabled } = req.body;
    const settings = await notificationSettingsRepository.upsert(req.staff!.id, {
      reminders_enabled,
      reminder_minutes_before,
      new_appointment_enabled,
      changes_enabled,
      cancellations_enabled,
    });
    res.json(settings);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar preferencias de notificacao", err);
    res.status(500).json({ error: "Erro ao atualizar preferencias de notificacao." });
  }
}
