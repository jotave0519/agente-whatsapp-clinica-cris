import cron from "node-cron";
import * as notificationSettingsRepository from "../repositories/notificationSettingsRepository";
import * as scheduleReminderLogRepository from "../repositories/scheduleReminderLogRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import * as staffRepository from "../repositories/staffRepository";
import * as notificationService from "../services/notificationService";

/**
 * A cada minuto, verifica os atendimentos de hoje e dispara o "lembrete de
 * atendimento" (push pra equipe) pra quem estiver dentro da antecedencia
 * configurada - o horario de disparo nunca fica salvo, e sempre recalculado
 * ao vivo a partir de schedule.date/time - reminder_minutes_before, entao uma
 * remarcacao so precisa limpar o schedule_reminder_log (ja feito em
 * schedulingService.rescheduleAppointment) pra funcionar certo de novo.
 */
export function scheduleNotificationReminderCron(): void {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        await processDueNotificationReminders();
      } catch (err) {
        console.error("Erro na rotina de lembretes de notificacao (equipe):", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}

export async function processDueNotificationReminders(): Promise<void> {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const schedules = await scheduleRepository.findSchedulesByDate(today);
  if (schedules.length === 0) return;

  const allStaff = await staffRepository.listAll();
  const activeStaff = allStaff.filter((s) => s.active);
  if (activeStaff.length === 0) return;

  const settingsByStaffId = await notificationSettingsRepository.findByStaffIds(activeStaff.map((s) => s.id));
  const loggedPairs = await scheduleReminderLogRepository.findLoggedPairs(schedules.map((s) => s.id));

  for (const schedule of schedules) {
    const start = new Date(`${schedule.date}T${schedule.time.slice(0, 5)}:00-03:00`);
    if (start.getTime() <= now.getTime()) continue; // ja passou - nunca lembra de atendimento que ja aconteceu

    for (const staff of activeStaff) {
      const settings = settingsByStaffId[staff.id];
      if (!settings.reminders_enabled) continue;

      const key = `${schedule.id}:${staff.id}`;
      if (loggedPairs.has(key)) continue;

      const remindAt = start.getTime() - settings.reminder_minutes_before * 60_000;
      if (now.getTime() < remindAt) continue; // ainda nao chegou a antecedencia configurada

      const { title, body } = notificationService.buildReminderMessage(schedule, settings.reminder_minutes_before);
      await notificationService.notifyReminder({ staffId: staff.id, title, body, scheduleId: schedule.id });
      await scheduleReminderLogRepository.log(schedule.id, staff.id);
      loggedPairs.add(key);
    }
  }
}
